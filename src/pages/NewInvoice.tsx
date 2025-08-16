import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft, Download } from "lucide-react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays } from "date-fns";
import { InvoiceHTML } from "@/components/InvoiceHTML";
import { getDefaultTemplate } from "@/services/templateService";
import { downloadPdfFromFunction } from "@/lib/edgePdf";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  vat_number: string | null;
  payment_terms: string | null;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string;
}

const NewInvoice = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<string>("draft");
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: "",
      quantity: 1,
      unit_price: 0,
      vat_rate: 0.18,
      unit: "service",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [templateForPreview, setTemplateForPreview] = useState<any | null>(null);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>("");
  const discountInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch customers
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

  // Generate invoice number
  const generateInvoiceNumber = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_number")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].invoice_number;
        const match = lastNumber.match(/INV-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const invoiceNum = `INV-${String(nextNumber).padStart(6, '0')}`;
      setInvoiceNumber(invoiceNum);
    } catch (error) {
      console.error("Error generating invoice number:", error);
    }
  };

  // Pre-select customer if coming from customer page or load invoice data for editing
  const clientId = searchParams.get("client");
  useEffect(() => {
    if (clientId && customers.length > 0) {
      setSelectedCustomer(clientId);
    }
  }, [clientId, customers]);

  // Load invoice data if in edit mode
  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      fetchInvoiceData(id);
    }
  }, [id]);

  const fetchInvoiceData = async (invoiceId: string) => {
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select(`
          *,
          invoice_items (
            description,
            quantity,
            unit,
            unit_price,
            vat_rate
          )
        `)
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      setInvoiceNumber(invoiceData.invoice_number);
      setSelectedCustomer(invoiceData.customer_id);
      setInvoiceDate(invoiceData.invoice_date || invoiceData.created_at.split("T")[0]);
      setStatus(invoiceData.status);
      setDiscountType((invoiceData as any).discount_type || 'amount');
      setDiscountValue(Number((invoiceData as any).discount_value || 0));
      setDiscountReason((invoiceData as any).discount_reason || '');
      
      if (invoiceData.invoice_items && invoiceData.invoice_items.length > 0) {
        setItems(invoiceData.invoice_items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          unit: item.unit,
        })));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load invoice data",
        variant: "destructive",
      });
      navigate("/invoices");
    }
  };

  useEffect(() => {
    fetchCustomers();
    if (!isEditMode) {
      generateInvoiceNumber();
    }
  }, [isEditMode]);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const t = await getDefaultTemplate();
        setTemplateForPreview(t as any);
      } catch (e) {
        // Fallback handled by consumer
      }
    };
    loadTemplate();
  }, []);

  useEffect(() => {
    if (searchParams.get('focus') === 'discount') {
      setTimeout(() => discountInputRef.current?.focus(), 0);
    }
  }, [searchParams]);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, vat_rate: 0.18, unit: "service" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const calculateTotals = () => {
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    // Subtotal per item and per VAT rate
    const perRate = new Map<number, number>();
    let subtotal = 0;
    items.forEach((item) => {
      const net = (item.quantity || 0) * (item.unit_price || 0);
      subtotal += net;
      const rate = item.vat_rate || 0;
      perRate.set(rate, (perRate.get(rate) || 0) + net);
    });

    // Discount amount
    let discountAmount = 0;
    if (discountType === 'percent') {
      const pct = Math.min(Math.max(Number(discountValue) || 0, 0), 100);
      discountAmount = round2(subtotal * (pct / 100));
    } else {
      const amt = Math.min(Math.max(Number(discountValue) || 0, 0), subtotal);
      discountAmount = round2(amt);
    }

    // Allocate discount pro‑rata by net across rates
    let taxable = 0;
    let vatTotal = 0;
    const totalNet = subtotal;
    perRate.forEach((rateNet, rate) => {
      const share = totalNet > 0 ? (rateNet / totalNet) : 0;
      const rateDiscount = round2(discountAmount * share);
      const rateTaxable = Math.max(rateNet - rateDiscount, 0);
      taxable += rateTaxable;
      vatTotal += round2(rateTaxable * rate);
    });

    taxable = round2(taxable);
    vatTotal = round2(vatTotal);
    const grandTotal = round2(taxable + vatTotal);

    return { netTotal: round2(subtotal), discountAmount, taxable, vatTotal, grandTotal };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!selectedCustomer) {
        throw new Error("Please select a customer");
      }

      if (items.some(item => !item.description || item.quantity <= 0 || item.unit_price < 0)) {
        throw new Error("Please fill in all item details");
      }

      // Get selected customer's payment terms to calculate due date
      const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
      const paymentTerms = selectedCustomerData?.payment_terms || "Net 30";
      
      // Extract number of days from payment terms (e.g., "Net 30" -> 30)
      const daysMatch = paymentTerms.match(/\d+/);
      const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
      
      // Calculate due date from invoice date + payment terms
      const invoiceDateObj = new Date(invoiceDate);
      const calculatedDueDate = addDays(invoiceDateObj, paymentDays);

      const { taxable, vatTotal, grandTotal } = calculateTotals();

      const invoiceData = {
        invoice_number: invoiceNumber,
        customer_id: selectedCustomer,
        amount: taxable,
        vat_amount: vatTotal,
        total_amount: grandTotal,
        invoice_date: invoiceDate,
        due_date: calculatedDueDate.toISOString().split("T")[0],
        status: status,
        user_id: user?.id,
        discount_type: discountType,
        discount_value: discountValue,
        discount_reason: discountReason,
      };

      if (isEditMode && id) {
        // Update existing invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", id);

        if (invoiceError) throw invoiceError;

        // Delete existing items and insert new ones
        const { error: deleteError } = await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", id);

        if (deleteError) throw deleteError;

        const itemsData = items.map(item => ({
          invoice_id: id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
        }));

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(itemsData);

        if (itemsError) throw itemsError;

        toast({
          title: "Invoice updated",
          description: "Invoice has been successfully updated.",
        });
      } else {
        // Create new invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert([invoiceData])
          .select("id")
          .single();

        if (invoiceError) throw invoiceError;

        // Create invoice items
        const itemsData = items.map(item => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
        }));

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(itemsData);

        if (itemsError) throw itemsError;

        toast({
          title: "Invoice created",
          description: "Invoice has been successfully created.",
        });
      }

      navigate("/invoices");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      const family = (templateForPreview as any)?.font_family || 'Inter';
      await downloadPdfFromFunction(invoiceNumber || 'invoice-preview', family);
      toast({ title: 'Success', description: 'Invoice downloaded successfully' });
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to download invoice',
        variant: 'destructive',
      });
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
                  <Link to="/invoices">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Invoices
                  </Link>
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {isEditMode ? "Edit Invoice" : "New Invoice"}
                  </h1>
                  <p className="text-muted-foreground">
                    {isEditMode ? "Update existing invoice" : "Create a new Malta VAT-compliant invoice"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Invoice Details */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Invoice Details</CardTitle>
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
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                      <Input
                        id="invoiceNumber"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="INV-000001"
                        required
                        readOnly={!isEditMode} // Auto-generated for new invoices
                      />
                    </div>

                    <div>
                      <Label htmlFor="invoiceDate">Invoice Date *</Label>
                      <Input
                        id="invoiceDate"
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {selectedCustomer && (
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      <strong>Due Date Preview:</strong> {(() => {
                        const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
                        const paymentTerms = selectedCustomerData?.payment_terms || "Net 30";
                        const daysMatch = paymentTerms.match(/\d+/);
                        const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
                        const calculatedDueDate = addDays(new Date(invoiceDate), paymentDays);
                        return format(calculatedDueDate, "PPP");
                      })()}
                      <br />
                      <strong>Payment Terms:</strong> {customers.find(c => c.id === selectedCustomer)?.payment_terms || "Net 30"}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Summary</CardTitle>
                </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Discount Type</Label>
                      <ToggleGroup
                        type="single"
                        value={discountType}
                        onValueChange={(v) => v && setDiscountType(v as 'amount' | 'percent')}
                      >
                        <ToggleGroupItem value="amount" aria-label="Amount (€)">
                          Amount (€)
                        </ToggleGroupItem>
                        <ToggleGroupItem value="percent" aria-label="Percent (%)">
                          Percent (%)
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="discountValue">Discount</Label>
                        <Input
                          id="discountValue"
                          ref={discountInputRef}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          max={discountType === 'percent' ? 100 : totals.netTotal}
                          value={discountValue}
                          onChange={(e) => {
                            let v = parseFloat(e.target.value);
                            if (isNaN(v)) v = 0;
                            if (discountType === 'percent') {
                              v = Math.max(0, Math.min(100, v));
                            } else {
                              v = Math.max(0, Math.min(totals.netTotal, v));
                            }
                            setDiscountValue(v);
                          }}
                        />
                        {discountType === 'percent' ? (
                          <p className="text-xs text-muted-foreground mt-1">Allowed: 0–100%</p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">Max: €{totals.netTotal.toFixed(2)}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="discountReason">Reason (optional)</Label>
                        <Textarea
                          id="discountReason"
                          placeholder="Add a note for this discount"
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">Calculation order: Subtotal → Discount → Taxable → VAT → Total</p>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>€{totals.netTotal.toFixed(2)}</span>
                      </div>
                      {totals.discountAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Discount</span>
                          <span>
                            —€{totals.discountAmount.toFixed(2)}
                            {discountType === 'percent' && (
                              <> ({Number(discountValue).toFixed(2)}%)</>
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Taxable Amount</span>
                        <span>€{totals.taxable.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT</span>
                        <span>€{totals.vatTotal.toFixed(2)}</span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex justify-between font-bold">
                          <span>Total</span>
                          <span>€{totals.grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
              </Card>
            </div>

            {/* Invoice Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Invoice Items</CardTitle>
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
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Service description"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      
                      <div>
                        <Label>Unit Price (€) *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      
                      <div>
                        <Label>VAT Rate</Label>
                        <Select 
                          value={item.vat_rate.toString()} 
                          onValueChange={(value) => updateItem(index, 'vat_rate', parseFloat(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0% (Exempt)</SelectItem>
                            <SelectItem value="0.05">5%</SelectItem>
                            <SelectItem value="0.18">18% (Standard)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          VAT: €{(item.quantity * item.unit_price * item.vat_rate).toFixed(2)}
                        </p>
                      </div>
                      
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
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
                <Link to="/invoices">Cancel</Link>
              </Button>
              {isEditMode && status !== 'draft' && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleDownloadPDF}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : (isEditMode ? "Update Invoice" : "Create Invoice")}
              </Button>
            </div>
          </form>
        </main>
      </div>

      {/* Hidden Font Injector for Google Font based on template */}
      <div style={{ display: 'none' }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent((templateForPreview as any)?.font_family || 'Inter')}:wght@400;600;700&display=swap`}
          rel="stylesheet"
        />
      </div>

      {/* A4 canvas + template CSS variables */}
      <style>{`
        @page { size: A4; margin: 0; }
        #invoice-preview-root{
          --font: '${(templateForPreview as any)?.font_family || 'Inter'}', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          --color-primary: ${(templateForPreview as any)?.primary_color || '#111827'};
          --color-accent: ${(templateForPreview as any)?.accent_color || '#2563EB'};
          --th-bg: ${(templateForPreview as any)?.line_item_header_bg || '#F3F4F6'};
          --th-text: ${(templateForPreview as any)?.line_item_header_text || '#111827'};

          /* margins (cm) */
          --m-top: ${typeof (templateForPreview as any)?.margin_top === 'number' ? `${(templateForPreview as any).margin_top}cm` : '1.2cm'};
          --m-right: ${typeof (templateForPreview as any)?.margin_right === 'number' ? `${(templateForPreview as any).margin_right}cm` : '1.2cm'};
          --m-bottom: ${typeof (templateForPreview as any)?.margin_bottom === 'number' ? `${(templateForPreview as any).margin_bottom}cm` : '1.2cm'};
          --m-left: ${typeof (templateForPreview as any)?.margin_left === 'number' ? `${(templateForPreview as any).margin_left}cm` : '1.2cm'};

          width: 21cm; min-height: 29.7cm; background:#fff; color: var(--color-primary);
          font-family: var(--font);
          box-sizing: border-box; position: relative;
        }
        #invoice-inner{
          padding-top: var(--m-top);
          padding-right: var(--m-right);
          padding-bottom: var(--m-bottom);
          padding-left: var(--m-left);
        }
        table.items{ width:100%; border-collapse:collapse; font-size:10pt; }
        table.items th{
          background: var(--th-bg); color: var(--th-text);
          padding: 8pt; text-align:left; border-bottom: 1px solid #E5E7EB;
        }
        table.items td{ padding: 8pt; border-bottom: 1px solid #E5E7EB; }
        .totals{ width:45%; margin-left:auto; font-size:10pt; margin-top:8pt; }
        .totals .row{ display:grid; grid-template-columns:1fr auto; padding:4pt 0; }
        .totals .row.total{ font-weight:700; border-top:1px solid #E5E7EB; padding-top:8pt; }
      `}</style>

      {/* Hidden A4 DOM used for 1:1 export */}
      <section id="invoice-preview-root" style={{ display: 'none', width: '21cm', minHeight: '29.7cm', background: '#fff' }}>
        <div id="invoice-inner">
          {selectedCustomer && (
            <InvoiceHTML 
              invoiceData={{
                invoiceNumber: invoiceNumber,
                invoiceDate: invoiceDate,
                dueDate: (() => {
                  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
                  const paymentTerms = selectedCustomerData?.payment_terms || "Net 30";
                  const daysMatch = paymentTerms.match(/\d+/);
                  const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
                  const invoiceDateObj = new Date(invoiceDate);
                  const calculatedDueDate = addDays(invoiceDateObj, paymentDays);
                  return calculatedDueDate.toISOString().split("T")[0];
                })(),
                customer: {
                  name: customers.find(c => c.id === selectedCustomer)?.name || '',
                  email: customers.find(c => c.id === selectedCustomer)?.email || undefined,
                  address: customers.find(c => c.id === selectedCustomer)?.address || undefined,
                  vat_number: customers.find(c => c.id === selectedCustomer)?.vat_number || undefined,
                },
                items: items,
                totals: {
                  netTotal: totals.taxable,
                  vatTotal: totals.vatTotal,
                  grandTotal: totals.grandTotal,
                },
                discount: totals.discountAmount > 0 ? {
                  type: discountType,
                  value: discountValue,
                  amount: totals.discountAmount,
                } : undefined,
              }}
              template={(templateForPreview as any) || {
                id: 'default',
                name: 'Default Template',
                is_default: true,
                primary_color: '#26A65B',
                accent_color: '#1F2D3D',
                font_family: 'Inter',
                font_size: '14px',
                logo_x_offset: 0,
                logo_y_offset: 0,
              } as any}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default NewInvoice;