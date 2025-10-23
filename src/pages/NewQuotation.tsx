import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { addDays, format } from "date-fns";
import { formatNumber } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  vat_number: string | null;
  payment_terms: string | null;
}

interface QuotationItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string;
}

const NewQuotation = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [quotationNumber, setQuotationNumber] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState<string>(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [status, setStatus] = useState<string>("draft");
  const [items, setItems] = useState<QuotationItem[]>([
    { description: "", quantity: 1, unit_price: 0, vat_rate: 0.18, unit: "service" },
  ]);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, address, vat_number, payment_terms")
        .order("name");
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load customers", variant: "destructive" });
    }
  };

  const generateQuotationNumber = async () => {
    try {
      const { data, error } = await supabase
        .from("quotations")
        .select("quotation_number")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      let nextNumber = 1;
      if (data && data.length > 0) {
        const last = data[0].quotation_number || "";
        const match = last.match(/QUO-(\d+)/);
        if (match) nextNumber = parseInt(match[1]) + 1;
      }
      setQuotationNumber(`QUO-${String(nextNumber).padStart(6, "0")}`);
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
        .select(`*, quotation_items (description, quantity, unit, unit_price, vat_rate)`) 
        .eq("id", quotationId)
        .single();
      if (error) throw error;
      setQuotationNumber(data.quotation_number);
      setSelectedCustomer(data.customer_id);
      setIssueDate(data.issue_date || data.created_at.split("T")[0]);
      setValidUntil(data.valid_until);
      setStatus(data.status || "draft");
      if (data.quotation_items && data.quotation_items.length > 0) {
        setItems(
          data.quotation_items.map((i: any) => ({
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
            vat_rate: i.vat_rate,
            unit: i.unit,
          }))
        );
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to load quotation", variant: "destructive" });
      navigate("/quotations");
    }
  };

  useEffect(() => {
    fetchCustomers();
    if (!isEditMode) generateQuotationNumber();
  }, [isEditMode]);

  // Recompute default valid until when issue date changes (only if user didn't manually change?)
  useEffect(() => {
    if (!isEditMode) setValidUntil(format(addDays(new Date(issueDate), 30), "yyyy-MM-dd"));
  }, [issueDate, isEditMode]);

  const addItem = () => setItems([...items, { description: "", quantity: 1, unit_price: 0, vat_rate: 0.18, unit: "service" }]);
  const removeItem = (index: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)); };
  const updateItem = (index: number, field: keyof QuotationItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value } as QuotationItem;
    setItems(updated);
  };

  const calculateTotals = () => {
    const net = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const vat = items.reduce((s, i) => s + i.quantity * i.unit_price * i.vat_rate, 0);
    const total = net + vat;
    return { net, vat, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!selectedCustomer) throw new Error("Please select a customer");
      if (items.some(i => !i.description || i.quantity <= 0 || i.unit_price < 0)) throw new Error("Please fill in all item details");

      const { net, vat, total } = calculateTotals();

      const payload: TablesInsert<'quotations'> = {
        quotation_number: quotationNumber,
        customer_id: selectedCustomer,
        amount: net,
        vat_amount: vat,
        total_amount: total,
        issue_date: issueDate,
        valid_until: validUntil,
        status,
        user_id: user?.id,
        vat_rate: 0.18,
      };

      if (isEditMode && id) {
        const { error: upErr } = await supabase.from("quotations").update(payload).eq("id", id);
        if (upErr) throw upErr;
        // replace items
        const { error: delErr } = await supabase.from("quotation_items").delete().eq("quotation_id", id);
        if (delErr) throw delErr;
        const itemsPayload = items.map(it => ({
          quotation_id: id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
        }));
        const { error: insErr } = await supabase.from("quotation_items").insert(itemsPayload);
        if (insErr) throw insErr;
        toast({ title: "Quotation updated", description: "Quotation has been updated." });
      } else {
        const { data: q, error: qErr } = await supabase.from("quotations").insert([payload]).select("id").single();
        if (qErr) throw qErr;
        const itemsPayload = items.map(it => ({
          quotation_id: q.id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
        }));
        const { error: insErr } = await supabase.from("quotation_items").insert(itemsPayload);
        if (insErr) throw insErr;
        toast({ title: "Quotation created", description: "Quotation has been created." });
      }

      navigate("/quotations");
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "An error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" asChild>
                  <Link to="/quotations">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Quotations
                  </Link>
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{isEditMode ? "Edit Quotation" : "New Quotation"}</h1>
                  <p className="text-muted-foreground">{isEditMode ? "Update existing quotation" : "Create a new quotation"}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quotation Details */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Quotation Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customer">Customer *</Label>
                      <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="quotationNumber">Quotation Number *</Label>
                      <Input id="quotationNumber" value={quotationNumber} onChange={(e) => setQuotationNumber(e.target.value)} placeholder="QUO-000001" required readOnly={!isEditMode} />
                    </div>

                    <div>
                      <Label htmlFor="issueDate">Issue Date *</Label>
                      <Input id="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
                    </div>

                    <div>
                      <Label htmlFor="validUntil">Valid Until *</Label>
                      <Input id="validUntil" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedCustomer && (
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      <strong>Validity:</strong> Until {format(new Date(validUntil), "PPP")}<br />
                      <strong>Customer payment terms:</strong> {customers.find(c => c.id === selectedCustomer)?.payment_terms || "Not set"}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quotation Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Quotation Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>€{formatNumber(totals.net, 2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT Total:</span>
                    <span>€{formatNumber(totals.vat, 2)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between font-bold">
                      <span>Grand Total:</span>
                      <span>€{formatNumber(totals.total, 2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quotation Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Quotation Items</CardTitle>
                  <Button type="button" onClick={addItem} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 border rounded-lg">
                      <div className="md:col-span-2">
                        <Label>Description *</Label>
                        <Input value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Service description" required />
                      </div>
                      <div>
                        <Label>Quantity *</Label>
                        <Input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} required />
                      </div>
                      <div>
                        <Label>Unit Price (€) *</Label>
                        <Input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)} required />
                      </div>
                      <div>
                        <Label>VAT Rate</Label>
                        <Select value={item.vat_rate.toString()} onValueChange={(v) => updateItem(index, 'vat_rate', parseFloat(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0% (Exempt)</SelectItem>
                            <SelectItem value="0.05">5%</SelectItem>
                            <SelectItem value="0.18">18% (Standard)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">VAT: €{formatNumber(item.quantity * item.unit_price * item.vat_rate, 2)}</p>
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeItem(index)} disabled={items.length === 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" asChild>
                <Link to="/quotations">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : (isEditMode ? "Update Quotation" : "Create Quotation")}</Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
};

export default NewQuotation;
