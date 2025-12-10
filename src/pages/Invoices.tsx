import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Shield,
  CheckCircle,
  FileMinus2, // NEW
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { formatCurrency } from "@/lib/utils";
import { InvoiceErrorBoundary } from "@/components/InvoiceErrorBoundary";
import { creditNotesService } from "@/services/creditNotesService"; // ✅ FIXED


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
  is_issued?: boolean;
  issued_at?: string;
  invoice_hash?: string;
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
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load template using unified hook
  const { template } = useInvoiceTemplate();

  // Load company and banking settings
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();

  const [exportInvoice, setExportInvoice] = useState<Invoice | null>(null);
  const [exportItems, setExportItems] = useState<any[]>([]);
  const [exportTotals, setExportTotals] = useState<{
    net: number;
    vat: number;
    total: number;
    originalSubtotal?: number;
    discountAmount?: number;
  } | null>(null);

  // Mark as Paid modal state
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<Invoice | null>(null);
  const [markPaidData, setMarkPaidData] = useState({
    payment_date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
  });
  const [markPaidLoading, setMarkPaidLoading] = useState(false);

  // NEW: track which invoice is currently issuing a credit note
  const [issuingCreditNoteId, setIssuingCreditNoteId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    // Return early if no user
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
          *,
          customers (
            name,
            email,
            address,
            vat_number,
            payment_terms
          )
        `,
        )
        .eq("user_id", user.id)
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
  }, [user]);

  useEffect(() => {
    let filtered = invoices;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  }, [searchTerm, statusFilter, invoices]);

  const handleDeleteInvoice = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id).eq("user_id", user.id);

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

  // Handle opening Mark as Paid dialog
  const handleOpenMarkPaid = (invoice: Invoice) => {
    setMarkPaidInvoice(invoice);
    setMarkPaidData({
      payment_date: format(new Date(), "yyyy-MM-dd"),
      amount: String(invoice.total_amount || invoice.amount || 0),
    });
    setShowMarkPaidDialog(true);
  };

  // Handle Mark as Paid submission
  const handleMarkAsPaid = async () => {
    if (!markPaidInvoice || !user) return;

    const amount = parseFloat(markPaidData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    setMarkPaidLoading(true);
    try {
      // Insert payment record
      const { error: paymentError } = await supabase.from("payments").insert({
        user_id: user.id,
        invoice_id: markPaidInvoice.id,
        amount: amount,
        payment_date: markPaidData.payment_date,
        method: "bank_transfer",
      });

      if (paymentError) throw paymentError;

      // Update invoice status to paid
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", markPaidInvoice.id)
        .eq("user_id", user.id);

      if (invoiceError) throw invoiceError;

      toast({
        title: "Invoice marked as paid",
        description: `Payment of ${formatCurrency(amount)} recorded for ${markPaidInvoice.invoice_number}.`,
      });

      setShowMarkPaidDialog(false);
      setMarkPaidInvoice(null);
      fetchInvoices();
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setMarkPaidLoading(false);
    }
  };

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      console.log("[Invoices] Starting PDF download for invoice:", invoiceId);

      const invoice = invoices.find((inv) => inv.id === invoiceId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Validate template is loaded
      if (!template) {
        console.error("[Invoices] Template not loaded");
        throw new Error("Template not loaded. Please refresh the page.");
      }

      // Validate company settings
      if (!companySettings?.company_name) {
        toast({
          title: "Company Settings Required",
          description: "Please complete your company information in Settings before downloading PDFs.",
          variant: "destructive",
        });
        return;
      }

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId);
      if (itemsError) throw itemsError;

      const { data: totalsData } = await supabase
        .from("invoice_totals")
        .select("net_amount, vat_amount, total_amount")
        .eq("invoice_id", invoiceId)
        .maybeSingle();

      // Calculate discount
      const originalSubtotal = (itemsData || []).reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const discountValue = Number(invoice.discount_value || 0);
      const discountType = (invoice.discount_type as "amount" | "percent") || "amount";
      let discountAmount = 0;

      if (discountValue > 0) {
        if (discountType === "percent") {
          discountAmount = originalSubtotal * (discountValue / 100);
        } else {
          discountAmount = discountValue;
        }
      }

      const netAfterDiscount = originalSubtotal - discountAmount;
      const net = totalsData?.net_amount ?? netAfterDiscount;
      const vat =
        totalsData?.vat_amount ??
        (itemsData || []).reduce((s, i) => s + i.quantity * i.unit_price * (i.vat_rate || 0), 0);
      const total = totalsData?.total_amount ?? net + vat;

      // Set export state with invoice data
      setExportInvoice(invoice);
      setExportItems(itemsData || []);
      setExportTotals({
        net: Number(net),
        vat: Number(vat),
        total: Number(total),
        originalSubtotal,
        discountAmount,
      });

      // Wait for DOM update
      await new Promise(requestAnimationFrame);

      // Use edge PDF generation
      await downloadPdfFromFunction(`Invoice-${invoice.invoice_number}`, template.font_family);

      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      console.error("[Invoices] PDF download error:", error);
      toast({
        title: "Error",
        description: `Failed to download PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  // NEW: create a credit note from an issued invoice
  const handleIssueCreditNote = async (invoice: Invoice) => {
  if (!user) return;

  try {
    const result = await creditNotesService.createCreditNoteFromInvoice(
      invoice.id,
      user.id
    );

    if (result?.success) {
      toast({
        title: "Credit note issued",
        description: `A full credit note was created for invoice ${invoice.invoice_number}.`,
      });
      fetchInvoices();
    }
  } catch (error: any) {
    console.error("Error issuing credit note:", error);
    toast({
      title: "Error issuing credit note",
      description: error?.message || "Failed to create credit note",
      variant: "destructive",
    });
  }
};

      setIssuingCreditNoteId(invoice.id);

      const cn = await createCreditNoteFromInvoice({
        invoiceId: invoice.id,
        reason: `Credit note for invoice ${invoice.invoice_number}`,
      });

      toast({
        title: "Credit note created",
        description: `Credit note ${cn.credit_note_number} has been created.`,
      });

      // Refresh invoice list so status updates to credited
      fetchInvoices();
    } catch (error: any) {
      console.error("Error issuing credit note:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create credit note.",
        variant: "destructive",
      });
    } finally {
      setIssuingCreditNoteId(null);
    }
  };

  const getStatusBadge = (invoice: Invoice) => {
    // Determine actual status based on is_issued and status
    const isIssued = (invoice as any).is_issued;
    const status = invoice.status;

    if (status === "credited") {
      return {
        className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
        label: "Credited",
        icon: null,
      };
    }

    if (status === "paid") {
      return {
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        label: "Paid",
        icon: null,
      };
    }

    if (isIssued) {
      return {
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        label: "Issued",
        icon: Shield,
      };
    }

    // Draft or pending
    return {
      className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      label: "Draft",
      icon: null,
    };
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
                <p className="text-muted-foreground">Manage your Malta VAT-compliant invoices</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" onClick={() => navigate("/invoices/import?entity=invoices")}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/invoices/export?entity=invoices")}>
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
                  Filter (
                  {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border border-border z-50">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Invoices</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("issued")}>Issued</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("paid")}>Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("credited")}>Credited</DropdownMenuItem>
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">
                        Loading invoices...
                      </TableCell>
                    </TableRow>
                  ) : filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">
                        {searchTerm || statusFilter !== "all"
                          ? "No invoices found matching your criteria."
                          : "No invoices found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const totalAmount = invoice.total_amount || invoice.amount || 0;
                      const statusBadge = getStatusBadge(invoice);
                      const StatusIcon = statusBadge.icon;

                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {invoice.invoice_number}
                              {(invoice as any).is_issued && (
                                <span title="Malta VAT Compliant - Immutable">
                                  <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{invoice.customers?.name || "Unknown Customer"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{formatCurrency(totalAmount)}</span>
                              {Number(invoice.discount_value || 0) > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  Discount
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusBadge.className}>
                              <span className="flex items-center gap-1.5">
                                {StatusIcon && <StatusIcon className="h-3 w-3" />}
                                {statusBadge.label}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{format(new Date(invoice.invoice_date || invoice.created_at), "dd/MM/yyyy")}</span>
                              {(invoice as any).is_issued && (invoice as any).issued_at && (
                                <span className="text-xs text-muted-foreground">
                                  Issued: {format(new Date((invoice as any).issued_at), "dd/MM/yy")}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(invoice.due_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {invoice.status !== "paid" && invoice.status !== "credited" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                  onClick={() => handleOpenMarkPaid(invoice)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Paid
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-background border border-border z-50">
                                  <DropdownMenuItem asChild>
                                    <Link to={`/invoices/${invoice.id}`}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View
                                    </Link>
                                  </DropdownMenuItem>
                                  {!(invoice as any).is_issued && (
                                    <DropdownMenuItem asChild>
                                      <Link to={`/invoices/edit/${invoice.id}`}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleDownloadPDF(invoice.id)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download PDF
                                  </DropdownMenuItem>

                                  {/* NEW: Issue Credit Note for issued, non-credited invoices */}
                                  {(invoice as any).is_issued && invoice.status !== "credited" && (
                                    <DropdownMenuItem
                                      onClick={() => handleIssueCreditNote(invoice)}
                                      disabled={issuingCreditNoteId === invoice.id}
                                    >
                                      <FileMinus2 className="h-4 w-4 mr-2" />
                                      {issuingCreditNoteId === invoice.id ? "Issuing..." : "Issue Credit Note"}
                                    </DropdownMenuItem>
                                  )}

                                  {!(invoice as any).is_issued && (
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteInvoice(invoice.id)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                  {(invoice as any).is_issued && (
                                    <DropdownMenuItem disabled className="text-muted-foreground">
                                      <Shield className="h-4 w-4 mr-2" />
                                      Immutable (VAT Compliant)
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
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
        <div style={{ display: "none" }}>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(template?.font_family || "Inter")}:wght@400;600;700&display=swap`}
            rel="stylesheet"
          />
        </div>

        {/* A4 canvas + template CSS variables */}
        <style>{`
          @page { size: A4; margin: 0; }
          #invoice-preview-root{
            --font: '${template?.font_family || "Inter"}', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            --color-primary: ${template?.primary_color || "#111827"};
            --color-accent: ${template?.accent_color || "#2563EB"};
            --th-bg: ${(template as any)?.line_item_header_bg || "#F3F4F6"};
            --th-text: ${(template as any)?.line_item_header_text || "#111827"};

            /* margins (cm) */
            --m-top: ${typeof (template as any)?.margin_top === "number" ? `${(template as any).margin_top}cm` : "1.2cm"};
            --m-right: ${typeof (template as any)?.margin_right === "number" ? `${(template as any).margin_right}cm` : "1.2cm"};
            --m-bottom: ${typeof (template as any)?.margin_bottom === "number" ? `${(template as any).margin_bottom}cm` : "1.2cm"};
            --m-left: ${typeof (template as any)?.margin_left === "number" ? `${(template as any).margin_left}cm` : "1.2cm"};

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
        <div style={{ display: "none" }}>
          {exportInvoice && template && (
            <InvoiceErrorBoundary>
              <UnifiedInvoiceLayout
                id="invoice-preview-root"
                variant="pdf"
                templateId={template.id}
                debug={false}
                invoiceData={{
                  invoiceNumber: exportInvoice.invoice_number,
                  invoiceDate: format(new Date(exportInvoice.invoice_date || exportInvoice.created_at), "yyyy-MM-dd"),
                  dueDate: exportInvoice.due_date,
                  customer: {
                    name: exportInvoice.customers?.name || "Unknown Customer",
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
                  discount:
                    (exportTotals?.discountAmount ?? 0) > 0
                      ? {
                          type: (exportInvoice.discount_type as "amount" | "percent") || "amount",
                          value: Number(exportInvoice.discount_value || 0),
                          amount: exportTotals?.discountAmount ?? 0,
                        }
                      : undefined,
                }}
                templateSettings={{
                  primaryColor: template.primary_color,
                  accentColor: template.accent_color,
                  fontFamily: template.font_family,
                  fontSize: template.font_size,
                  layout: template?.layout || "default",
                  headerLayout: template?.header_layout || "default",
                  tableStyle: template?.table_style || "default",
                  totalsStyle: template?.totals_style || "default",
                  bankingVisibility: template?.banking_visibility !== false,
                  bankingStyle: template?.banking_style || "default",
                  marginTop: template?.margin_top || 20,
                  marginRight: template?.margin_right || 20,
                  marginBottom: template?.margin_bottom || 20,
                  marginLeft: template?.margin_left || 20,
                }}
                companySettings={
                  companySettings
                    ? {
                        name: companySettings.company_name,
                        email: companySettings.company_email,
                        phone: companySettings.company_phone,
                        address: companySettings.company_address,
                        city: companySettings.company_city,
                        state: companySettings.company_state,
                        zipCode: companySettings.company_zip_code,
                        country: companySettings.company_country,
                        taxId: companySettings.company_vat_number,
                        registrationNumber: companySettings.company_registration_number,
                        logo: companySettings.company_logo,
                      }
                    : undefined
                }
                bankingSettings={
                  bankingSettings
                    ? {
                        bankName: bankingSettings.bank_name,
                        accountName: bankingSettings.bank_account_name,
                        iban: bankingSettings.bank_iban,
                        swiftCode: bankingSettings.bank_swift_code,
                      }
                    : undefined
                }
              />
            </InvoiceErrorBoundary>
          )}
        </div>

        {/* Mark as Paid Dialog */}
        <Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle>Mark as Paid</DialogTitle>
              <DialogDescription>Record payment for {markPaidInvoice?.invoice_number}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="mark_paid_amount">Amount (€)</Label>
                <Input
                  id="mark_paid_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={markPaidData.amount}
                  onChange={(e) => setMarkPaidData({ ...markPaidData, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mark_paid_date">Payment Date</Label>
                <Input
                  id="mark_paid_date"
                  type="date"
                  value={markPaidData.payment_date}
                  onChange={(e) => setMarkPaidData({ ...markPaidData, payment_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowMarkPaidDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleMarkAsPaid} disabled={markPaidLoading}>
                {markPaidLoading ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Invoices;
