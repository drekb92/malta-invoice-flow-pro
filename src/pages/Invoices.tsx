
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
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  MoreHorizontal,
  Eye,
  Edit,
  Mail,
  Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { InvoiceHTML } from "@/components/InvoiceHTML";
import { getDefaultTemplate } from "@/services/templateService";
import { downloadPdfFromFunction } from "@/lib/edgePdf";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  invoice_date: string;
  vat_rate: number;
  due_date: string;
  status: string;
  created_at: string;
  discount_value?: number;
  discount_type?: string;
  discount_reason?: string;
  customers?: {
    name: string;
    email?: string;
    address?: string;
    vat_number?: string;
    payment_terms: string | null;
  };
}

const Invoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [templateForPreview, setTemplateForPreview] = useState<any | null>(null);
  const [exportInvoice, setExportInvoice] = useState<Invoice | null>(null);
  const [exportItems, setExportItems] = useState<any[]>([]);
  const [exportTotals, setExportTotals] = useState<{ net: number; vat: number; total: number; originalSubtotal?: number; discountAmount?: number } | null>(null);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          customers (
            name,
            email,
            address,
            vat_number,
            payment_terms
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setInvoices(data || []);
      setFilteredInvoices(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    const loadTemplate = async () => {
      try { const t = await getDefaultTemplate(); setTemplateForPreview(t as any); } catch {}
    };
    loadTemplate();
  }, []);

  useEffect(() => {
    let filtered = invoices;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter((invoice) =>
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customers?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  }, [searchTerm, statusFilter, invoices]);

  const handleDeleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Invoice deleted",
        description: "Invoice has been successfully removed.",
      });
      
      fetchInvoices();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Fetch items and totals to render exact DOM
      const { data: itemsData, error: itemsError } = await (supabase as any)
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);
      if (itemsError) throw itemsError;

      const { data: totalsData } = await (supabase as any)
        .from('invoice_totals')
        .select('net_amount, vat_amount, total_amount')
        .eq('invoice_id', invoiceId)
        .maybeSingle();

      // Calculate original subtotal before discount
      const originalSubtotal = (itemsData || []).reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
      
      // Calculate discount information
      const discountValue = Number(invoice.discount_value || 0);
      const discountType = (invoice.discount_type as 'amount' | 'percent') || 'amount';
      let discountAmount = 0;
      
      if (discountValue > 0) {
        if (discountType === 'percent') {
          discountAmount = originalSubtotal * (discountValue / 100);
        } else {
          discountAmount = discountValue;
        }
      }

      // Calculate net after discount (taxable amount)
      const netAfterDiscount = originalSubtotal - discountAmount;
      
      const net = totalsData?.net_amount ?? netAfterDiscount;
      const vat = totalsData?.vat_amount ?? (itemsData || []).reduce((s: number, i: any) => s + i.quantity * i.unit_price * (i.vat_rate || 0), 0);
      const total = totalsData?.total_amount ?? net + vat;

      // Prepare hidden DOM state with discount info
      setExportInvoice(invoice);
      setExportItems(itemsData || []);
      setExportTotals({ 
        net: Number(net), 
        vat: Number(vat), 
        total: Number(total),
        originalSubtotal,
        discountAmount
      });

      // Ensure template is ready
      const tpl = templateForPreview || (await getDefaultTemplate());
      setTemplateForPreview(tpl as any);

      // Wait for DOM to paint
      await new Promise(requestAnimationFrame);

      await downloadPdfFromFunction(invoice.invoice_number || 'invoice', (tpl as any)?.font_family || 'Inter');

      toast({ title: 'Success', description: 'PDF downloaded successfully' });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };
    return variants[status as keyof typeof variants] || variants.draft;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
                <p className="text-muted-foreground">
                  Manage your Malta VAT-compliant invoices
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/invoices/import?entity=invoices')}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/invoices/export?entity=invoices')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
                <Button asChild>
                  <Link to="/invoices/new">
                    <Plus className="h-4 w-4 mr-2" />
                    New Invoice
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Filters and Search */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search invoices..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter ({statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Invoices</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pending</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("paid")}>Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>Overdue</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        Loading invoices...
                      </TableCell>
                    </TableRow>
                  ) : filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        {searchTerm || statusFilter !== "all" ? "No invoices found matching your criteria." : "No invoices found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const totalAmount = invoice.total_amount || invoice.amount || 0;
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{invoice.customers?.name || "Unknown Customer"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>€{totalAmount.toFixed(2)}</span>
                              {Number(invoice.discount_value || 0) > 0 && (
                                <Badge variant="secondary">Discount</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(invoice.status)}>
                              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(invoice.invoice_date || invoice.created_at), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{format(new Date(invoice.due_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{invoice.customers?.payment_terms || "Not set"}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/invoices/${invoice.id}`}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`/invoices/edit/${invoice.id}`}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDownloadPDF(invoice.id)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteInvoice(invoice.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>

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
            {exportInvoice && (
              <InvoiceHTML
                invoiceData={{
                  invoiceNumber: exportInvoice.invoice_number,
                  invoiceDate: format(new Date(exportInvoice.invoice_date || exportInvoice.created_at), 'yyyy-MM-dd'),
                  dueDate: exportInvoice.due_date,
                  customer: {
                    name: exportInvoice.customers?.name || 'Unknown Customer',
                    email: exportInvoice.customers?.email || undefined,
                    address: exportInvoice.customers?.address || undefined,
                    vat_number: exportInvoice.customers?.vat_number || undefined,
                  },
                  items: exportItems.map((i: any) => ({
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    vat_rate: i.vat_rate,
                    unit: i.unit,
                  })),
                  totals: {
                    netTotal: Number(exportTotals?.net ?? 0),
                    vatTotal: Number(exportTotals?.vat ?? 0),
                    grandTotal: Number(exportTotals?.total ?? 0),
                  },
                  discount: (exportTotals?.discountAmount ?? 0) > 0 ? {
                    type: (exportInvoice.discount_type as 'amount' | 'percent') || 'amount',
                    value: Number(exportInvoice.discount_value || 0),
                    amount: exportTotals?.discountAmount ?? 0,
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
    </div>
  );
};

export default Invoices;
