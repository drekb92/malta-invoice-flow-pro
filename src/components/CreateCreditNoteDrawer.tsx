import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Shield, Loader2, Trash2, Info, Plus, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string | null;
}

interface CreateCreditNoteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId?: string | null; // For viewing/editing existing credit notes
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  customerId: string;
  customerName?: string;
  defaultType?: "invoice_adjustment" | "customer_credit";
  onSuccess?: () => void;
}

interface ValidationErrors {
  reason?: string;
  total?: string;
  exceedsRemaining?: string;
  description?: string;
}

const CREDIT_NOTE_REASONS = [
  { value: "pricing_error", label: "Pricing Error" },
  { value: "quantity_adjustment", label: "Quantity Adjustment" },
  { value: "damaged_goods", label: "Damaged Goods" },
  { value: "incorrect_specification", label: "Incorrect Specification" },
  { value: "customer_return", label: "Customer Return" },
  { value: "service_not_rendered", label: "Service Not Rendered" },
  { value: "overpayment_correction", label: "Overpayment Correction" },
  { value: "discount_applied", label: "Discount Applied" },
  { value: "goodwill_credit", label: "Goodwill Credit" },
  { value: "prepayment", label: "Prepayment / Deposit" },
  { value: "other", label: "Other" },
];

const DEFAULT_VAT_RATE = 0.18;

export function CreateCreditNoteDrawer({
  open,
  onOpenChange,
  creditNoteId,
  invoiceId,
  invoiceNumber,
  customerId,
  customerName,
  defaultType = "invoice_adjustment",
  onSuccess,
}: CreateCreditNoteDrawerProps) {
  const { toast } = useToast();
  
  // Mode: invoice-linked vs standalone
  const isStandalone = !invoiceId && !creditNoteId;
  
  // Form state
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [originalItems, setOriginalItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Single amount mode (for standalone credits)
  const [singleAmountMode, setSingleAmountMode] = useState(isStandalone);
  const [singleAmount, setSingleAmount] = useState<string>("");
  const [singleDescription, setSingleDescription] = useState<string>("");
  const [singleVatRate, setSingleVatRate] = useState<number>(DEFAULT_VAT_RATE);
  
  // Invoice data for validation (only for invoice-linked)
  const [invoiceTotal, setInvoiceTotal] = useState<number>(0);
  const [invoiceStatus, setInvoiceStatus] = useState<string | null>(null);
  const [existingCredits, setExistingCredits] = useState<number>(0);
  const [existingPayments, setExistingPayments] = useState<number>(0);
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showValidation, setShowValidation] = useState(false);
  
  // Existing credit note state (for edit/view mode)
  const [existingCreditNote, setExistingCreditNote] = useState<{
    id: string;
    credit_note_number: string;
    status: string;
    issued_at: string | null;
    invoice_id: string | null;
    type: string;
  } | null>(null);
  
  // Determine if the credit note is locked (issued)
  const isLocked = existingCreditNote?.status === "issued";
  const isEditMode = !!creditNoteId;

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setValidationErrors({});
      setShowValidation(false);
      setExistingCreditNote(null);
      
      if (creditNoteId) {
        // Load existing credit note
        loadExistingCreditNote();
      } else {
        // Create mode - reset form
        setReason("");
        setDescription("");
        setSingleAmount("");
        setSingleDescription("");
        setSingleAmountMode(isStandalone);
        
        if (invoiceId) {
          loadInvoiceData();
        } else {
          setLineItems([]);
          setOriginalItems([]);
          setLoading(false);
        }
      }
    }
  }, [open, creditNoteId, invoiceId]);

  const loadExistingCreditNote = async () => {
    if (!creditNoteId) return;
    
    setLoading(true);
    try {
      const [creditNoteResult, itemsResult] = await Promise.all([
        (supabase as any)
          .from("credit_notes")
          .select("*")
          .eq("id", creditNoteId)
          .single(),
        supabase
          .from("credit_note_items")
          .select("*")
          .eq("credit_note_id", creditNoteId)
          .order("id", { ascending: true }),
      ]);

      if (creditNoteResult.error) throw creditNoteResult.error;

      const cn = creditNoteResult.data;
      setExistingCreditNote({
        id: cn.id,
        credit_note_number: cn.credit_note_number,
        status: cn.status,
        issued_at: cn.issued_at,
        invoice_id: cn.invoice_id,
        type: cn.type,
      });

      // Parse reason to extract the reason code
      const reasonMatch = CREDIT_NOTE_REASONS.find(r => cn.reason?.startsWith(r.label));
      if (reasonMatch) {
        setReason(reasonMatch.value);
        const afterLabel = cn.reason.substring(reasonMatch.label.length);
        setDescription(afterLabel.startsWith(": ") ? afterLabel.substring(2) : "");
      } else {
        setReason("other");
        setDescription(cn.reason || "");
      }

      const items = (itemsResult.data || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        vat_rate: Number(item.vat_rate),
        unit: item.unit,
      }));

      // Check if it's single amount mode (one item with unit="credit")
      if (items.length === 1 && items[0].unit === "credit") {
        setSingleAmountMode(true);
        setSingleAmount(String(items[0].unit_price));
        setSingleDescription(items[0].description);
        setSingleVatRate(items[0].vat_rate);
      } else {
        setSingleAmountMode(false);
        setLineItems(items);
        setOriginalItems(items);
      }

      // Load invoice data if linked
      if (cn.invoice_id) {
        const [invoiceResult, creditsResult, paymentsResult] = await Promise.all([
          supabase
            .from("invoices")
            .select("total_amount")
            .eq("id", cn.invoice_id)
            .single(),
          supabase
            .from("credit_notes")
            .select("amount, vat_rate")
            .eq("invoice_id", cn.invoice_id)
            .neq("id", creditNoteId), // Exclude current credit note
          supabase
            .from("payments")
            .select("amount")
            .eq("invoice_id", cn.invoice_id),
        ]);

        if (invoiceResult.data) {
          setInvoiceTotal(Number(invoiceResult.data.total_amount) || 0);
        }
        
        const totalCredits = (creditsResult.data || []).reduce((sum: number, c: any) => {
          const gross = Number(c.amount) * (1 + Number(c.vat_rate || 0));
          return sum + gross;
        }, 0);
        setExistingCredits(totalCredits);
        
        const totalPayments = (paymentsResult.data || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        setExistingPayments(totalPayments);
      }
    } catch (error) {
      console.error("Error loading credit note:", error);
      toast({
        title: "Error",
        description: "Failed to load credit note",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceData = async () => {
    if (!invoiceId) return;
    
    setLoading(true);
    try {
      const [itemsResult, invoiceResult, creditsResult, paymentsResult] = await Promise.all([
        supabase
          .from("invoice_items")
          .select("id, description, quantity, unit_price, vat_rate, unit")
          .eq("invoice_id", invoiceId)
          .order("created_at", { ascending: true }),
        supabase
          .from("invoices")
          .select("total_amount, status")
          .eq("id", invoiceId)
          .single(),
        supabase
          .from("credit_notes")
          .select("amount, vat_rate")
          .eq("invoice_id", invoiceId),
        supabase
          .from("payments")
          .select("amount")
          .eq("invoice_id", invoiceId),
      ]);

      if (itemsResult.error) throw itemsResult.error;

      // Check invoice status - block credit note creation for invalid statuses
      const status = invoiceResult.data?.status;
      setInvoiceStatus(status || null);
      
      if (status === "paid" || status === "draft" || status === "cancelled") {
        toast({
          title: "Cannot create credit note",
          description: "Credit notes can only be created for issued unpaid invoices.",
          variant: "destructive",
        });
        onOpenChange(false);
        return;
      }

      const items = (itemsResult.data || []).map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        vat_rate: Number(item.vat_rate),
      }));

      setOriginalItems(items);
      setLineItems(items);
      
      if (invoiceResult.data) {
        setInvoiceTotal(Number(invoiceResult.data.total_amount) || 0);
      }
      
      const totalCredits = (creditsResult.data || []).reduce((sum, cn) => {
        const gross = Number(cn.amount) * (1 + Number(cn.vat_rate || 0));
        return sum + gross;
      }, 0);
      setExistingCredits(totalCredits);
      
      const totalPayments = (paymentsResult.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      setExistingPayments(totalPayments);
      
    } catch (error) {
      console.error("Error loading invoice data:", error);
      toast({
        title: "Error",
        description: "Failed to load invoice data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    if (singleAmountMode) {
      const netTotal = parseFloat(singleAmount) || 0;
      const vatTotal = netTotal * singleVatRate;
      const grandTotal = netTotal + vatTotal;
      return { netTotal, vatTotal, grandTotal };
    }
    
    const netTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const vatTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price * item.vat_rate, 0);
    const grandTotal = netTotal + vatTotal;
    return { netTotal, vatTotal, grandTotal };
  }, [lineItems, singleAmountMode, singleAmount, singleVatRate]);

  // Calculate remaining invoice amount
  const remainingAmount = useMemo(() => {
    if (!invoiceId) return Infinity;
    return Math.max(0, invoiceTotal - existingCredits - existingPayments);
  }, [invoiceId, invoiceTotal, existingCredits, existingPayments]);

  // Validate form
  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    if (!reason) {
      errors.reason = "Please select a reason for this credit note";
    }
    
    if (totals.grandTotal <= 0) {
      errors.total = "Credit note total must be greater than zero";
    }
    
    if (singleAmountMode && !singleDescription.trim()) {
      errors.description = "Please enter a description for this credit";
    }
    
    // Only check remaining for invoice-linked credits
    if (invoiceId && totals.grandTotal > remainingAmount && remainingAmount > 0) {
      errors.exceedsRemaining = `Credit amount (€${formatNumber(totals.grandTotal, 2)}) exceeds the remaining invoice balance of €${formatNumber(remainingAmount, 2)}`;
    } else if (invoiceId && totals.grandTotal > invoiceTotal && remainingAmount === 0) {
      errors.exceedsRemaining = `Credit amount (€${formatNumber(totals.grandTotal, 2)}) exceeds the invoice total of €${formatNumber(invoiceTotal, 2)}`;
    }
    
    return errors;
  };

  // Update line item
  const updateLineItem = (index: number, field: keyof LineItem, value: number | string) => {
    setLineItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
    if (showValidation && validationErrors.total) {
      setValidationErrors(prev => ({ ...prev, total: undefined, exceedsRemaining: undefined }));
    }
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  // Add new line item (for standalone mode)
  const addLineItem = () => {
    const newItem: LineItem = {
      id: `new-${Date.now()}`,
      description: "",
      quantity: 1,
      unit_price: 0,
      vat_rate: DEFAULT_VAT_RATE,
      unit: "unit",
    };
    setLineItems(prev => [...prev, newItem]);
  };

  // Reset to original items
  const resetItems = () => {
    setLineItems(originalItems);
    setValidationErrors(prev => ({ ...prev, total: undefined, exceedsRemaining: undefined }));
  };

  // Handle reason change
  const handleReasonChange = (value: string) => {
    setReason(value);
    if (showValidation && validationErrors.reason) {
      setValidationErrors(prev => ({ ...prev, reason: undefined }));
    }
  };

  // Generate credit note number using database function
  const generateCreditNoteNumber = async (userId: string): Promise<string> => {
    const { data, error } = await supabase.rpc("next_credit_note_number", {
      p_business_id: userId,
      p_prefix: "CN-",
    });

    if (error) {
      console.error("Error generating credit note number:", error);
      // Fallback to timestamp-based number if RPC fails
      const now = new Date();
      const year = now.getFullYear();
      const seq = String(now.getTime()).slice(-4);
      return `CN-${year}-${seq}`;
    }

    return data as string;
  };

  // Submit handler
  const handleSubmit = async (action: "draft" | "issue") => {
    if (action === "issue") {
      const errors = validateForm();
      setValidationErrors(errors);
      setShowValidation(true);
      
      if (Object.keys(errors).length > 0) {
        return;
      }
    } else {
      // For draft, only require basic validation
      if (totals.grandTotal <= 0) {
        toast({
          title: "Cannot save draft",
          description: "Please add at least one line item with a value.",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const creditNoteNumber = await generateCreditNoteNumber(userId);
      const reasonText = reason 
        ? `${CREDIT_NOTE_REASONS.find(r => r.value === reason)?.label || reason}${description ? `: ${description}` : ""}`
        : description || "Credit note";

      const creditType = invoiceId ? "invoice_adjustment" : "customer_credit";

      const creditNoteData = {
        credit_note_number: creditNoteNumber,
        invoice_id: invoiceId || null,
        customer_id: customerId,
        user_id: userId,
        amount: totals.netTotal,
        vat_rate: singleAmountMode ? singleVatRate : (lineItems[0]?.vat_rate || DEFAULT_VAT_RATE),
        reason: reasonText,
        type: creditType,
        status: action === "draft" ? "draft" : "issued",
        issued_at: action === "issue" ? new Date().toISOString() : null,
        credit_note_date: new Date().toISOString().split("T")[0],
      };

      const { data: creditNote, error: creditNoteError } = await supabase
        .from("credit_notes")
        .insert(creditNoteData)
        .select("id")
        .single();

      if (creditNoteError) throw creditNoteError;

      // Create credit note items
      let itemsPayload;
      if (singleAmountMode) {
        itemsPayload = [{
          credit_note_id: creditNote.id,
          description: singleDescription || reasonText,
          quantity: 1,
          unit_price: parseFloat(singleAmount) || 0,
          vat_rate: singleVatRate,
          unit: "credit",
        }];
      } else {
        itemsPayload = lineItems
          .filter(item => item.quantity > 0 && item.unit_price > 0)
          .map(item => ({
            credit_note_id: creditNote.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            vat_rate: item.vat_rate,
            unit: item.unit || "unit",
          }));
      }

      if (itemsPayload.length > 0) {
        const { error: itemsError } = await supabase
          .from("credit_note_items")
          .insert(itemsPayload);

        if (itemsError) throw itemsError;
      }

      // Log audit trail if issued and invoice-linked
      if (action === "issue" && invoiceId) {
        await supabase.from("invoice_audit_log").insert({
          invoice_id: invoiceId,
          user_id: userId,
          action: "credit_note_created",
          new_data: {
            credit_note_id: creditNote.id,
            credit_note_number: creditNoteNumber,
            amount: totals.netTotal,
            reason: reasonText,
          },
        });
      }

      toast({
        title: action === "draft" ? "Draft Saved" : "Credit Note Issued",
        description: `Credit Note ${creditNoteNumber} has been ${action === "draft" ? "saved as draft" : "issued"}.`,
      });

      // Reset form and close
      setReason("");
      setDescription("");
      setLineItems([]);
      setSingleAmount("");
      setSingleDescription("");
      setValidationErrors({});
      setShowValidation(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating credit note:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create credit note",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const ValidationMessage = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-1.5">
        <Info className="h-3.5 w-3.5 shrink-0" />
        {message}
      </p>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border/60">
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {existingCreditNote?.credit_note_number 
              ? `Credit Note ${existingCreditNote.credit_note_number}`
              : isStandalone 
                ? "New Customer Credit" 
                : "Create Credit Note"
            }
          </SheetTitle>
          <SheetDescription>
            {existingCreditNote?.credit_note_number
              ? `${customerName || "Customer"} • ${isLocked ? "Issued" : "Draft"}`
              : invoiceNumber 
                ? `For invoice ${invoiceNumber} (Malta VAT Compliant)`
                : customerName 
                  ? `For ${customerName} (Malta VAT Compliant)`
                  : "Malta VAT Compliant"
            }
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Issued Lock Banner */}
              {isLocked && (
                <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-800 dark:text-amber-300">Issued Credit Note</AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                    Issued credit notes cannot be edited. This ensures compliance with Malta VAT regulations.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Malta VAT Compliance Alert */}
              {!isLocked && (
                <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                  <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-800 dark:text-blue-300">Malta VAT Compliance</AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
                    {isStandalone 
                      ? "Customer credits are tracked for accounting and can be applied to future invoices."
                      : "Credit notes correct issued invoices per Malta VAT regulations. This action will be logged in the audit trail."
                    }
                  </AlertDescription>
                </Alert>
              )}

              {/* Remaining Balance Info (only for invoice-linked) */}
              {(invoiceId || existingCreditNote?.invoice_id) && remainingAmount > 0 && !isLocked && (
                <div className="bg-muted/50 p-3 rounded-md text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice Total:</span>
                    <span>€{formatNumber(invoiceTotal, 2)}</span>
                  </div>
                  {existingCredits > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Existing Credits:</span>
                      <span className="text-amber-600">-€{formatNumber(existingCredits, 2)}</span>
                    </div>
                  )}
                  {existingPayments > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payments Received:</span>
                      <span className="text-green-600">-€{formatNumber(existingPayments, 2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium border-t pt-1 mt-1">
                    <span>Remaining Balance:</span>
                    <span>€{formatNumber(remainingAmount, 2)}</span>
                  </div>
                </div>
              )}

              {/* Reason Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Reason {!isLocked && <span className="text-destructive">*</span>}
                </Label>
                <Select value={reason} onValueChange={handleReasonChange} disabled={submitting || isLocked}>
                  <SelectTrigger className={`bg-background ${showValidation && validationErrors.reason ? 'border-amber-500' : ''} ${isLocked ? 'opacity-70' : ''}`}>
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {CREDIT_NOTE_REASONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showValidation && <ValidationMessage message={validationErrors.reason} />}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Additional Details</Label>
                <Textarea
                  placeholder="Optional details for the credit note..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`min-h-[60px] resize-none ${isLocked ? 'opacity-70' : ''}`}
                  disabled={submitting || isLocked}
                  maxLength={500}
                  readOnly={isLocked}
                />
              </div>

              <Separator />

              {/* Single Amount Toggle (for standalone mode) */}
              {isStandalone && !isLocked && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Single amount credit</Label>
                    <p className="text-xs text-muted-foreground">
                      Enter a single amount instead of line items
                    </p>
                  </div>
                  <Switch
                    checked={singleAmountMode}
                    onCheckedChange={setSingleAmountMode}
                    disabled={submitting}
                  />
                </div>
              )}

              {/* Single Amount Mode */}
              {singleAmountMode ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Description {!isLocked && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      placeholder="e.g., Goodwill credit for delayed delivery"
                      value={singleDescription}
                      onChange={(e) => {
                        setSingleDescription(e.target.value);
                        if (showValidation && validationErrors.description) {
                          setValidationErrors(prev => ({ ...prev, description: undefined }));
                        }
                      }}
                      className={`${showValidation && validationErrors.description ? 'border-amber-500' : ''} ${isLocked ? 'opacity-70' : ''}`}
                      disabled={submitting || isLocked}
                      readOnly={isLocked}
                    />
                    {showValidation && <ValidationMessage message={validationErrors.description} />}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Amount (Net)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={singleAmount}
                          onChange={(e) => setSingleAmount(e.target.value)}
                          className={`pl-7 ${isLocked ? 'opacity-70' : ''}`}
                          disabled={submitting || isLocked}
                          readOnly={isLocked}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">VAT Rate</Label>
                      <Select 
                        value={String(singleVatRate)} 
                        onValueChange={(v) => setSingleVatRate(parseFloat(v))}
                        disabled={submitting || isLocked}
                      >
                        <SelectTrigger className={`bg-background ${isLocked ? 'opacity-70' : ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="0">0% (Zero-rated)</SelectItem>
                          <SelectItem value="0.05">5% (Reduced)</SelectItem>
                          <SelectItem value="0.18">18% (Standard)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : (
                /* Line Items Mode */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Line Items</Label>
                    {!isLocked && (
                      <div className="flex items-center gap-2">
                        {!isStandalone && !isEditMode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetItems}
                            disabled={submitting}
                            className="text-xs h-7"
                          >
                            Reset to Original
                          </Button>
                        )}
                        {(isStandalone || (isEditMode && !existingCreditNote?.invoice_id)) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addLineItem}
                            disabled={submitting}
                            className="text-xs h-7"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Item
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center border rounded-md border-dashed">
                      {isStandalone ? "Click 'Add Item' to add line items" : "No items to credit"}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lineItems.map((item, index) => (
                        <div key={item.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            {(isStandalone || (isEditMode && !existingCreditNote?.invoice_id)) && !isLocked ? (
                              <Input
                                placeholder="Description"
                                value={item.description}
                                onChange={(e) => updateLineItem(index, "description", e.target.value)}
                                className="text-sm h-8"
                                disabled={submitting}
                              />
                            ) : (
                              <p className="text-sm font-medium flex-1 line-clamp-2">{item.description}</p>
                            )}
                            {!isLocked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => removeLineItem(index)}
                                disabled={submitting}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Qty</Label>
                              {isLocked ? (
                                <div className="h-8 flex items-center text-sm">{item.quantity}</div>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                  disabled={submitting}
                                />
                              )}
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Unit Price</Label>
                              {isLocked ? (
                                <div className="h-8 flex items-center text-sm">€{formatNumber(item.unit_price, 2)}</div>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unit_price}
                                  onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                  disabled={submitting}
                                />
                              )}
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Line Total</Label>
                              <div className="h-8 flex items-center text-sm font-medium">
                                €{formatNumber(item.quantity * item.unit_price, 2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Totals */}
              <div className={`bg-muted p-4 rounded-lg space-y-2 ${showValidation && (validationErrors.total || validationErrors.exceedsRemaining) ? 'ring-1 ring-amber-500' : ''}`}>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Net Total:</span>
                  <span>€{formatNumber(totals.netTotal, 2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT:</span>
                  <span>€{formatNumber(totals.vatTotal, 2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Total Credit:</span>
                  <span className="text-primary">€{formatNumber(totals.grandTotal, 2)}</span>
                </div>
                {showValidation && <ValidationMessage message={validationErrors.total || validationErrors.exceedsRemaining} />}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 px-5 py-4 border-t border-border/60 bg-background">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  {isLocked ? "Close" : "Cancel"}
                </Button>
                {!isLocked && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleSubmit("draft")}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                      Save Draft
                    </Button>
                    <Button
                      onClick={() => handleSubmit("issue")}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                      Issue Credit Note
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
