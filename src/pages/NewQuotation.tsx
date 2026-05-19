import { useState, useEffect, useRef, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams, useParams, useBlocker } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { addDays, format } from "date-fns";
import { formatNumber } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useInvoiceSettings } from "@/hooks/useInvoiceSettings";
import { DocumentItem, validateDocumentItems, calculateQuotationTotals } from "@/lib/documentItems";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  vat_number: string | null;
  payment_terms: string | null;
}

type QuotationItem = DocumentItem;

const NewQuotation = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [quotationNumber, setQuotationNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState("");

  const [items, setItems] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Autosave state
  const [autosaveDraftId, setAutosaveDraftId] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const autosaveDraftIdRef = useRef<string | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  interface ResumeDraft { id: string; customerName: string; totalAmount: number; savedAt: Date; }
  const [resumeDraft, setResumeDraft] = useState<ResumeDraft | null>(null);
  const DRAFT_KEY = 'malta-quotation-draft';

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { settings: companySettings } = useCompanySettings();
  const { settings: invoiceSettings } = useInvoiceSettings();

  const { blocker, confirmAndProceed, cancelNavigation } = useUnsavedChangesGuard(isDirty);

  const defaultVatRate = invoiceSettings?.vat_rate_standard
    ? invoiceSettings.vat_rate_standard / 100
    : 0.18;
  const defaultPaymentDays = invoiceSettings?.default_payment_days || companySettings?.default_payment_terms || 30;

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, address, vat_number, payment_terms")
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    }
  };

  const generateQuotationNumber = async () => {
    try {
      const prefix = companySettings?.quotation_prefix || "QUO-";
      const { data, error } = await supabase
        .from("quotations")
        .select("quotation_number")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const last = data[0].quotation_number || "";
        // Match any prefix pattern: capture trailing digits
        const match = last.match(/(\d+)$/);
        if (match) nextNumber = parseInt(match[1]) + 1;
      }

      setQuotationNumber(`${prefix}${String(nextNumber).padStart(6, "0")}`);
    } catch (e) {
      console.error("Error generating quotation number", e);
    }
  };

  // Prefill from customer if passed
  const clientId = searchParams.get("client");
  useEffect(() => {
    if (clientId && customers.length > 0) setSelectedCustomer(clientId);
  }, [clientId, customers]);

  // Load existing quotation if edit
  // Re-generate number when prefix becomes available (new mode only)
  useEffect(() => {
    if (!id && companySettings) {
      generateQuotationNumber();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySettings?.quotation_prefix]);

  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      fetchQuotationData(id);
    }
  }, [id]);

  const fetchQuotationData = async (quotationId: string) => {
    try {
      const { data, error } = await supabase
        .from("quotations")
        .select(
          `*,
           quotation_items (
             description,
             quantity,
             unit,
             unit_price,
             vat_rate
           )`,
        )
        .eq("id", quotationId)
        .single();

      if (error) throw error;

      setQuotationNumber(data.quotation_number);
      setSelectedCustomer(data.customer_id);
      setIssueDate(data.issue_date || data.created_at.split("T")[0]);
      setValidUntil(data.valid_until);

      if (data.quotation_items && data.quotation_items.length > 0) {
        setItems(
          data.quotation_items.map((i: any) => ({
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
            vat_rate: i.vat_rate,
            unit: i.unit,
          })),
        );
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to load quotation",
        variant: "destructive",
      });
      navigate("/quotations");
    }
  };

  useEffect(() => {
    fetchCustomers();
    if (!isEditMode) generateQuotationNumber();
  }, [isEditMode]);

  // Recompute default valid until when issue date or payment days changes
  useEffect(() => {
    if (!isEditMode) {
      setValidUntil(format(addDays(new Date(issueDate), defaultPaymentDays), "yyyy-MM-dd"));
    }
  }, [issueDate, isEditMode, defaultPaymentDays]);

  // Initialize items with correct default VAT rate once settings load
  useEffect(() => {
    if (items.length === 0 && !isEditMode) {
      setItems([{ description: "", quantity: 1, unit_price: 0, vat_rate: defaultVatRate, unit: "service" }]);
    }
  }, [defaultVatRate, isEditMode]);

  const addItem = () => {
    setIsDirty(true);
    setItems((prev) => [
      ...prev,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: defaultVatRate,
        unit: "service",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setIsDirty(true);
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: string | number) => {
    setIsDirty(true);
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value,
    } as QuotationItem;
    setItems(updated);
  };

  const performAutosave = useCallback(async () => {
    if (isSavingRef.current) return;
    const snap = { selectedCustomer, quotationNumber, issueDate, validUntil, items };
    const hasContent = snap.selectedCustomer || snap.items.some(i => i.description.trim() || i.unit_price > 0);
    if (!hasContent) return;

    isSavingRef.current = true;
    setAutosaveStatus('saving');
    try {
      const { net, vat, total } = calculateQuotationTotals(snap.items);
      const payload = {
        quotation_number: snap.quotationNumber,
        customer_id: snap.selectedCustomer || null,
        amount: net,
        vat_amount: vat,
        total_amount: total,
        issue_date: snap.issueDate,
        valid_until: snap.validUntil,
        status: 'draft' as const,
        user_id: user?.id,
        vat_rate: 0.18,
      };

      if (autosaveDraftIdRef.current) {
        await supabase.from('quotations').update(payload).eq('id', autosaveDraftIdRef.current);
        await supabase.from('quotation_items').delete().eq('quotation_id', autosaveDraftIdRef.current);
        await supabase.from('quotation_items').insert(
          snap.items.map(i => ({ quotation_id: autosaveDraftIdRef.current!, ...i }))
        );
      } else {
        const { data: q } = await supabase.from('quotations').insert([payload]).select('id').single();
        if (q?.id) {
          autosaveDraftIdRef.current = q.id;
          setAutosaveDraftId(q.id);
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: q.id, savedAt: new Date() }));
          navigate(`/quotations/${q.id}/edit`, { replace: true });
          await supabase.from('quotation_items').insert(
            snap.items.map(i => ({ quotation_id: q.id, ...i }))
          );
        }
      }
      setAutosaveStatus('saved');
      setLastSavedAt(new Date());
    } catch {
      setAutosaveStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [user?.id, selectedCustomer, quotationNumber, issueDate, validUntil, items]);

  // Debounced autosave — fires 3s after any field change (new mode only)
  useEffect(() => {
    if (isEditMode) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(performAutosave, 3000);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [selectedCustomer, issueDate, validUntil, items, isEditMode, performAutosave]);

  // Flush autosave when tab hides
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'hidden' && !isEditMode) {
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        performAutosave();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [performAutosave, isEditMode]);

  // Check for a saved draft on mount (new mode only)
  useEffect(() => {
    if (id || !user?.id) return;
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return;
    try {
      const { id: draftId, savedAt } = JSON.parse(stored);
      if (Date.now() - new Date(savedAt).getTime() > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      supabase
        .from('quotations')
        .select('id, total_amount, customers(name)')
        .eq('id', draftId)
        .eq('status', 'draft')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setResumeDraft({
              id: data.id,
              customerName: (data.customers as any)?.name || 'No customer',
              totalAmount: data.total_amount || 0,
              savedAt: new Date(savedAt),
            });
            setShowResumeModal(true);
          } else {
            localStorage.removeItem(DRAFT_KEY);
          }
        });
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [id, user?.id]);

  const performQuotationSave = async ({ skipNavigate = false } = {}) => {
    setLoading(true);

    try {
      if (!selectedCustomer) {
        throw new Error("Please select a customer");
      }

      const validationError = validateDocumentItems(items);
      if (validationError) {
        throw new Error(validationError);
      }

      const { net, vat, total } = calculateQuotationTotals(items);

      const payload: TablesInsert<"quotations"> = {
        quotation_number: quotationNumber,
        customer_id: selectedCustomer,
        amount: net,
        vat_amount: vat,
        total_amount: total,
        issue_date: issueDate,
        valid_until: validUntil,
        status: "draft",
        user_id: user?.id,
        vat_rate: 0.18,
      };

      if (isEditMode && id) {
        const { error: upErr } = await supabase.from("quotations").update(payload).eq("id", id);
        if (upErr) throw upErr;

        // replace items
        const { error: delErr } = await supabase.from("quotation_items").delete().eq("quotation_id", id);
        if (delErr) throw delErr;

        const itemsPayload = items.map((it) => ({
          quotation_id: id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
        }));

        const { error: insErr } = await supabase.from("quotation_items").insert(itemsPayload);
        if (insErr) throw insErr;

        toast({
          title: "Quotation updated",
          description: "Quotation has been updated.",
        });
      } else {
        const { data: q, error: qErr } = await supabase.from("quotations").insert([payload]).select("id").single();
        if (qErr) throw qErr;

        const itemsPayload = items.map((it) => ({
          quotation_id: q.id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
        }));

        const { error: insErr } = await supabase.from("quotation_items").insert(itemsPayload);
        if (insErr) throw insErr;

        toast({
          title: "Quotation created",
          description: "Quotation has been created.",
        });

        if (!skipNavigate) {
          navigate(`/quotations?created=${q.id}`);
          return;
        }
      }

      setIsDirty(false);
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      localStorage.removeItem(DRAFT_KEY);
      autosaveDraftIdRef.current = null;
      setAutosaveDraftId(null);
      if (!skipNavigate) navigate("/quotations");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performQuotationSave();
  };

  const totals = calculateQuotationTotals(items);

  return (
    <>
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="md:ml-64">
        <main className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/quotations">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{isEditMode ? "Edit Quotation" : "New Quotation"}</h1>
                <p className="text-muted-foreground">
                  {isEditMode ? "Update existing quotation" : "Create a new quotation"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {autosaveStatus === 'saving' && <span className="text-xs text-muted-foreground">Saving…</span>}
              {autosaveStatus === 'saved' && lastSavedAt && (
                <span className="text-xs text-muted-foreground">Draft saved {format(lastSavedAt, 'HH:mm')}</span>
              )}
              {autosaveStatus === 'error' && <span className="text-xs text-destructive">Autosave failed</span>}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
            {/* Left column: details */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quotation Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Customer *</Label>
                    <Select value={selectedCustomer} onValueChange={(v) => { setSelectedCustomer(v); setIsDirty(true); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Quotation Number *</Label>
                      <Input
                        value={quotationNumber}
                        onChange={(e) => { setQuotationNumber(e.target.value); setIsDirty(true); }}
                        placeholder="QUO-000001"
                        required
                        readOnly={!isEditMode}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Issue Date *</Label>
                      <Input type="date" value={issueDate} onChange={(e) => { setIssueDate(e.target.value); setIsDirty(true); }} required />
                    </div>

                    <div className="space-y-2">
                      <Label>Valid Until *</Label>
                      <Input type="date" value={validUntil} onChange={(e) => { setValidUntil(e.target.value); setIsDirty(true); }} required />
                    </div>
                  </div>

                  {selectedCustomer && (
                    <p className="text-sm text-muted-foreground">
                      Validity: Until {format(new Date(validUntil), "PPP")} • Customer payment terms:{" "}
                      {customers.find((c) => c.id === selectedCustomer)?.payment_terms || "Not set"}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quotation Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>

                  {items.map((item, index) => (
                    <div key={index} className="grid gap-4 md:grid-cols-[2fr,1fr,1fr,1fr,auto]">
                      <div className="space-y-2">
                        <Label>Description *</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          placeholder="Service description"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Unit Price (€) *</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>VAT Rate</Label>
                        <Select
                          value={String(item.vat_rate)}
                          onValueChange={(v) => updateItem(index, "vat_rate", parseFloat(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0% (Exempt)</SelectItem>
                            <SelectItem value="0.05">5%</SelectItem>
                            <SelectItem value="0.07">7% (Accommodation)</SelectItem>
                            <SelectItem value="0.18">18% (Standard)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          VAT: €{formatNumber(item.quantity * item.unit_price * item.vat_rate, 2)}
                        </p>
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Right column: summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quotation Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>€{formatNumber(totals.net, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT Total:</span>
                    <span>€{formatNumber(totals.vat, 2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Grand Total:</span>
                    <span>€{formatNumber(totals.total, 2)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/quotations")}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Saving..." : isEditMode ? "Update Quotation" : "Create Quotation"}
                </Button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>

    <UnsavedChangesDialog
      open={blocker.state === 'blocked'}
      variant={(autosaveDraftId || autosaveDraftIdRef.current) && !isEditMode ? 'draft-autosave' : (isEditMode ? 'quotation-edit' : 'draft-no-autosave')}
      onSaveDraft={async () => {
        setIsDirty(false);
        await performQuotationSave({ skipNavigate: true });
        confirmAndProceed();
      }}
      onDiscard={async () => {
        if (autosaveDraftIdRef.current && !isEditMode) {
          await supabase.from('quotations').delete().eq('id', autosaveDraftIdRef.current);
          localStorage.removeItem(DRAFT_KEY);
        }
        setIsDirty(false);
        confirmAndProceed();
      }}
      onCancel={cancelNavigation}
    />

    {/* Resume draft modal */}
    {showResumeModal && resumeDraft && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-background border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Resume draft quotation?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A draft was saved on {format(resumeDraft.savedAt, 'PPP')} for {resumeDraft.customerName} (€{formatNumber(resumeDraft.totalAmount, 2)}).
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => { setShowResumeModal(false); navigate(`/quotations/${resumeDraft.id}/edit`); }}>
              Continue editing
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { localStorage.removeItem(DRAFT_KEY); setShowResumeModal(false); }}>
              Keep draft &amp; start new
            </Button>
            <Button variant="destructive" className="w-full" onClick={async () => {
              await supabase.from('quotations').delete().eq('id', resumeDraft.id);
              localStorage.removeItem(DRAFT_KEY);
              setShowResumeModal(false);
            }}>
              Discard draft
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default NewQuotation;
