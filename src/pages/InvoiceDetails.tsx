import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Mail, MessageCircle } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatNumber } from "@/lib/utils";
import { InvoiceHTML } from "@/components/InvoiceHTML";
import { getDefaultTemplate } from "@/services/templateService";
import { generateInvoicePDFWithTemplate } from "@/lib/pdfGenerator";
import type { InvoiceData } from "@/services/pdfService";
import { exportInvoicePdfAction } from "@/services/edgePdfExportAction";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  amount: number;
  vat_rate: number;
  due_date: string;
  status: string;
  created_at: string;
  invoice_date?: string;
  discount_type?: 'amount' | 'percent';
  discount_value?: number;
  discount_reason?: string;
  customers?: {
    name: string;
    email?: string | null;
    address?: string | null;
    vat_number?: string | null;
    phone?: string | null;
  };
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
}

interface InvoiceTotals {
  net_amount: number;
  vat_amount: number;
  total_amount: number;
}

const InvoiceDetails = () => {
  const { invoice_id } = useParams<{ invoice_id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceTotals, setInvoiceTotals] = useState<InvoiceTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateForPreview, setTemplateForPreview] = useState<any | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!invoice_id) return;

    const fetchInvoiceDetails = async () => {
      try {
        // Fetch invoice header
        const { data: invoiceData, error: invoiceError } = await supabase
          .from("invoices")
          .select(`
            *,
            customers (
              name, email, address, vat_number, phone
            )
          `)
          .eq("id", invoice_id)
          .single();

        if (invoiceError) throw invoiceError;

        // Fetch invoice items
        const { data: itemsData, error: itemsError } = await (supabase as any)
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", invoice_id);

        if (itemsError) throw itemsError;

        // Fetch invoice totals
        const { data: totalsData, error: totalsError } = await (supabase as any)
          .from("invoice_totals")
          .select("net_amount, vat_amount, total_amount")
          .eq("invoice_id", invoice_id)
          .maybeSingle();

        if (totalsError) throw totalsError;

        setInvoice({
          ...invoiceData,
          discount_type: invoiceData.discount_type as 'amount' | 'percent' | undefined
        });
        setInvoiceItems(itemsData || []);
        setInvoiceTotals(totalsData);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load invoice details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetails();
  }, [invoice_id, toast]);

  useEffect(() => {
    const loadTemplate = async () => {
      try { const t = await getDefaultTemplate(); setTemplateForPreview(t as any); } catch {}
    };
    loadTemplate();
  }, []);

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };
    return variants[status as keyof typeof variants] || variants.draft;
  };

  const computedTotals = useMemo(() => {
    if (invoiceTotals) {
      return {
        net: Number(invoiceTotals.net_amount || 0),
        vat: Number(invoiceTotals.vat_amount || 0),
        total: Number(invoiceTotals.total_amount || 0),
      };
    }
    const net = invoiceItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    const vat = invoiceItems.reduce((sum, i) => sum + i.quantity * i.unit_price * (i.vat_rate || 0), 0);
    return { net, vat, total: net + vat };
  }, [invoiceItems, invoiceTotals]);

  const discountInfo = useMemo(() => {
    if (!invoice) return { amount: 0, isPercent: false, percentValue: 0 };
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const subtotal = invoiceItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    const type = (invoice.discount_type as 'amount' | 'percent') || 'amount';
    const raw = Number(invoice.discount_value || 0);
    if (type === 'percent') {
      const pct = Math.min(Math.max(raw, 0), 100);
      return { amount: round2(subtotal * (pct / 100)), isPercent: true, percentValue: pct };
    } else {
      const amt = Math.min(Math.max(raw, 0), subtotal);
      return { amount: round2(amt), isPercent: false, percentValue: 0 };
    }
  }, [invoice, invoiceItems]);

  const handleDownload = async () => {
    if (!invoice) return;
    try {
      const filename = `Invoice-${invoice.invoice_number}`;
      const result = await exportInvoicePdfAction({
        filename,
        elementId: 'invoice-preview-root'
      });
      
      if (result.ok) {
        toast({ title: 'PDF downloaded', description: `Invoice ${invoice.invoice_number} saved.` });
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'PDF error', description: 'Failed to generate invoice PDF.', variant: 'destructive' });
    }
  };

  const handleLegacyDownload = async () => {
    if (!invoice) return;
    try {
      const invoiceData: InvoiceData = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date || invoice.created_at,
        dueDate: invoice.due_date,
        customer: {
          name: invoice.customers?.name || '',
          email: invoice.customers?.email || undefined,
          address: invoice.customers?.address || undefined,
          vat_number: invoice.customers?.vat_number || undefined,
        },
        items: invoiceItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate || 0,
          unit: item.unit || 'unit',
        })),
        totals: {
          netTotal: computedTotals.net,
          vatTotal: computedTotals.vat,
          grandTotal: computedTotals.total,
        },
      };
      await generateInvoicePDFWithTemplate(invoiceData, `Invoice-${invoice.invoice_number}`);
      toast({ title: 'PDF downloaded', description: `Invoice ${invoice.invoice_number} saved (legacy).` });
    } catch (e) {
      console.error(e);
      toast({ title: 'PDF error', description: 'Failed to generate invoice PDF.', variant: 'destructive' });
    }
  };

  const handleEmailReminder = () => {
    if (!invoice) return;
    const email = invoice.customers?.email || "";
    const subject = `Payment Reminder: Invoice ${invoice.invoice_number}`;
    const body = `Dear ${invoice.customers?.name || "Customer"},%0D%0A%0D%0AThis is a friendly reminder that invoice ${invoice.invoice_number} for €${formatNumber(computedTotals.total, 2)} is due on ${format(new Date(invoice.due_date), "dd/MM/yyyy")}.%0D%0A%0D%0AThank you.`;
    if (email) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${body}`;
    } else {
      toast({ title: "No email available", description: "Customer email not found.", variant: "destructive" });
    }
  };

  const handleWhatsAppReminder = () => {
    if (!invoice) return;
    const message = `Payment Reminder: Invoice ${invoice.invoice_number} of €${formatNumber(computedTotals.total, 2)} is due on ${format(new Date(invoice.due_date), "dd/MM/yyyy")}.`;
    const phoneRaw = invoice.customers?.phone || "";
    const phone = phoneRaw.replace(/\D/g, "");
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="md:ml-64">
          <div className="p-6">
            <div className="text-center py-12">
              Loading invoice details...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="md:ml-64">
          <div className="p-6">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">Invoice not found</h2>
              <p className="text-muted-foreground mb-4">The requested invoice could not be found.</p>
              <Link to="/invoices">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Invoices
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link to="/invoices">
                  <Button variant="ghost" size="sm" aria-label="Back to invoices">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to List
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Invoice {invoice.invoice_number}</h1>
                  <p className="text-muted-foreground">Invoice details and line items</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleDownload} aria-label="Download invoice PDF" title="Download invoice PDF">
                  <Download className="h-4 w-4" />
                  <span className="sr-only">Download</span>
                  <span className="hidden sm:inline">Download PDF</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLegacyDownload} aria-label="Legacy download" title="Legacy download">
                  <span className="hidden sm:inline">Legacy Download</span>
                </Button>
                <Button variant="secondary" onClick={handleEmailReminder} aria-label="Send email reminder" title="Send email reminder">
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">Email Reminder</span>
                </Button>
                <Button variant="secondary" onClick={handleWhatsAppReminder} aria-label="Send WhatsApp reminder" title="Send WhatsApp reminder">
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Invoice Header */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Invoice Number</label>
                  <p className="text-lg font-semibold">{invoice.invoice_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Customer</label>
                  <p className="text-lg">{invoice.customers?.name || "Unknown Customer"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Issue Date</label>
                  <p className="text-lg">{format(new Date((invoice as any).invoice_date || invoice.created_at), "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                  <p className="text-lg">{format(new Date(invoice.due_date), "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusBadge(invoice.status)}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>VAT Rate</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        No line items found for this invoice.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoiceItems.map((item) => {
                      const lineTotal = item.quantity * item.unit_price;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit || "-"}</TableCell>
                          <TableCell>€{formatNumber(item.unit_price, 2)}</TableCell>
                          <TableCell>{formatNumber(item.vat_rate * 100, 0)}%</TableCell>
                          <TableCell className="text-right">€{formatNumber(lineTotal, 2)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-w-sm ml-auto">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net Amount:</span>
                  <span className="font-medium">€{formatNumber(invoiceTotals?.net_amount ?? computedTotals.net, 2)}</span>
                </div>
                {discountInfo.amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="font-medium">—€{formatNumber(discountInfo.amount, 2)}{discountInfo.isPercent && <> ({formatNumber(discountInfo.percentValue, 2)}%)</>}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT Amount:</span>
                  <span className="font-medium">€{formatNumber(invoiceTotals?.vat_amount ?? computedTotals.vat, 2)}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold">Total Amount:</span>
                    <span className="text-lg font-bold">€{formatNumber(invoiceTotals?.total_amount ?? computedTotals.total, 2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
      <div id="invoice-html-preview" className="invoice-page" style={{ display: 'none', width: '210mm', minHeight: '297mm', background: '#fff' }}>
        <section id="invoice-preview-root" style={{ width: '21cm', minHeight: '29.7cm', background: '#fff' }}>
          <div id="invoice-inner">
            {invoice && (
              <InvoiceHTML
                id="invoice-preview-root"
                invoiceData={{
                  invoiceNumber: invoice.invoice_number,
                  invoiceDate: format(new Date((invoice as any).invoice_date || invoice.created_at), 'yyyy-MM-dd'),
                  dueDate: invoice.due_date,
                  customer: {
                    name: invoice.customers?.name || 'Unknown Customer',
                    email: invoice.customers?.email || undefined,
                    address: invoice.customers?.address || undefined,
                    vat_number: invoice.customers?.vat_number || undefined,
                  },
                  items: invoiceItems.map((i) => ({
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    vat_rate: i.vat_rate,
                    unit: i.unit,
                  })),
                  totals: {
                    netTotal: Number(invoiceTotals?.net_amount ?? computedTotals.net) - discountInfo.amount,
                    vatTotal: Number(invoiceTotals?.vat_amount ?? computedTotals.vat),
                    grandTotal: Number(invoiceTotals?.total_amount ?? computedTotals.total),
                  },
                  discount: discountInfo.amount > 0 ? {
                    type: (invoice.discount_type as 'amount' | 'percent') || 'amount',
                    value: Number(invoice.discount_value || 0),
                    amount: discountInfo.amount,
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
                layout={templateForPreview?.layout || 'default'}
              />
            )}
          </div>
        </section>
      </div>

    </div>
  );
};

export default InvoiceDetails;