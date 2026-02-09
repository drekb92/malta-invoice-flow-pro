// src/pages/Invoices.tsx
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
  Trash2,
  Shield,
  Wallet,
  FileMinus2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { useInvoiceSettings } from "@/hooks/useInvoiceSettings";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { formatCurrency } from "@/lib/utils";
import { InvoiceErrorBoundary } from "@/components/InvoiceErrorBoundary";
import { CreateCreditNoteDrawer } from "@/components/CreateCreditNoteDrawer";
import { InvoiceSettlementSheet } from "@/components/InvoiceSettlementSheet";

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
  last_sent_at?: string;
  last_sent_channel?: string;
  last_sent_to?: string;
  customers?: {
    name: string;
    email?: string;
    address?: string;
    address_line1?: string;
    address_line2?: string;
    locality?: string;
    post_code?: string;
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
  const { settings: invoiceSettings } = useInvoiceSettings();

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

  // Credit Note dialog state
  const [creditNoteInvoice, setCreditNoteInvoice] = useState<Invoice | null>(null);

  // Settlement Sheet state
  const [settlementInvoice, setSettlementInvoice] = useState<Invoice | null>(null);

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
            address_line1,
            address_line2,
            locality,
            post_code,
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
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoice_number?.toLowerCase().includes(term) || invoice.customers?.name?.toLowerCase().includes(term),
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "issued") {
        filtered = filtered.filter((invoice) => (invoice as any).is_issued);
      } else {
        filtered = filtered.filter((invoice) => invoice.status === statusFilter);
      }
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

      // Wait for React to fully render the updated DOM
      // Multiple frames + timeout ensures state changes are committed
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      await new Promise((resolve) => setTimeout(resolve, 100));

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

    if (status === "partially_paid") {
      return {
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
        label: "Partial",
        icon: null,
      };
    }

    if (status === "overdue") {
      return {
        className: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
        label: "Overdue",
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

  // 👉 Issue Credit Note handler: open the dialog
  const handleIssueCreditNote = (invoice: Invoice) => {
    setCreditNoteInvoice(invoice);
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
                    <TableHead className="sticky top-0 z-10 bg-card">Invoice #</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Customer</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Amount</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Status</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Issue Date</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Due Date</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card text-right">Actions</TableHead>
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
                            <button
                              type="button"
                              className="flex items-center gap-2 text-left hover:text-primary transition-colors group"
                              onClick={() => setSettlementInvoice(invoice)}
                            >
                              <span className="group-hover:underline">{invoice.invoice_number}</span>
                              {(invoice as any).is_issued && (
                                <span title="Malta VAT Compliant - Immutable">
                                  <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                </span>
                              )}
                            </button>
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
                            <div className="flex flex-col items-start gap-0.5">
                              <Badge className={`${statusBadge.className} w-fit whitespace-nowrap`}>
                                <span className="flex items-center gap-1.5">
                                  {StatusIcon && <StatusIcon className="h-3 w-3" />}
                                  {statusBadge.label}
                                </span>
                              </Badge>
                              {invoice.last_sent_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  Sent {format(new Date(invoice.last_sent_at), "dd MMM")} via{" "}
                                  {invoice.last_sent_channel === "whatsapp" ? "WhatsApp" : "Email"}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(invoice.invoice_date || invoice.created_at), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{format(new Date(invoice.due_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {invoice.status !== "paid" &&
                                invoice.status !== "credited" &&
                                invoice.status !== "draft" &&
                                invoice.status !== "cancelled" &&
                                (invoice as any).is_issued && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 px-2 text-xs"
                                          onClick={() => handleOpenMarkPaid(invoice)}
                                          aria-label="Add payment"
                                        >
                                          <Wallet className="h-3.5 w-3.5 md:mr-1" />
                                          <span className="hidden md:inline">Add payment</span>
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Record a payment for this invoice</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
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
                                  {invoice.status !== "paid" &&
                                    invoice.status !== "draft" &&
                                    invoice.status !== "cancelled" &&
                                    (invoice as any).is_issued && (
                                      <DropdownMenuItem onClick={() => handleIssueCreditNote(invoice)}>
                                        <div className="flex flex-col">
                                          <div className="flex items-center">
                                            <FileMinus2 className="h-4 w-4 mr-2" />
                                            Create credit note
                                          </div>
                                          <span className="text-xs text-muted-foreground ml-6">
                                            Linked to this invoice
                                          </span>
                                        </div>
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
            href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(
              template?.font_family || "Inter",
            )}:wght@400;600;700&display=swap`}
            rel="stylesheet"
          />
        </div>

        {/* PDF styles are embedded in UnifiedInvoiceLayout */}

        {/* Hidden A4 DOM used for 1:1 export */}
        <div style={{ display: "none" }}>
          {exportInvoice && template && (
            <InvoiceErrorBoundary>
              <UnifiedInvoiceLayout
                id="invoice-preview-root"
                variant="pdf"
                debug={false}
                invoiceData={{
                  invoiceNumber: exportInvoice.invoice_number,
                  invoiceDate: format(new Date(exportInvoice.invoice_date || exportInvoice.created_at), "yyyy-MM-dd"),
                  dueDate: exportInvoice.due_date,
                  customer: {
                    name: exportInvoice.customers?.name || "Unknown Customer",
                    email: exportInvoice.customers?.email || undefined,
                    address: exportInvoice.customers?.address || undefined,
                    address_line1: exportInvoice.customers?.address_line1 || undefined,
                    address_line2: exportInvoice.customers?.address_line2 || undefined,
                    locality: exportInvoice.customers?.locality || undefined,
                    post_code: exportInvoice.customers?.post_code || undefined,
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
                  style: template?.style || "modern",
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
                        addressLine1: companySettings.company_address_line1,
                        addressLine2: companySettings.company_address_line2,
                        locality: companySettings.company_locality,
                        postCode: companySettings.company_post_code,
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
                footerText={invoiceSettings?.invoice_footer_text}
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
                  onChange={(e) =>
                    setMarkPaidData({
                      ...markPaidData,
                      amount: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mark_paid_date">Payment Date</Label>
                <Input
                  id="mark_paid_date"
                  type="date"
                  value={markPaidData.payment_date}
                  onChange={(e) =>
                    setMarkPaidData({
                      ...markPaidData,
                      payment_date: e.target.value,
                    })
                  }
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

        {/* Credit Note Drawer */}
        <CreateCreditNoteDrawer
          open={!!creditNoteInvoice}
          onOpenChange={(open) => !open && setCreditNoteInvoice(null)}
          invoiceId={creditNoteInvoice?.id || ""}
          invoiceNumber={creditNoteInvoice?.invoice_number || ""}
          customerId={creditNoteInvoice?.customer_id || ""}
          onSuccess={() => {
            setCreditNoteInvoice(null);
            fetchInvoices();
          }}
        />

        {/* Invoice Settlement Sheet */}
        <InvoiceSettlementSheet
          open={!!settlementInvoice}
          onOpenChange={(open) => !open && setSettlementInvoice(null)}
          invoice={
            settlementInvoice
              ? {
                  id: settlementInvoice.id,
                  invoice_number: settlementInvoice.invoice_number,
                  invoice_date: settlementInvoice.invoice_date || settlementInvoice.created_at,
                  due_date: settlementInvoice.due_date,
                  status: settlementInvoice.status,
                  total_amount: settlementInvoice.total_amount || settlementInvoice.amount || 0,
                  amount: settlementInvoice.amount,
                  vat_amount: settlementInvoice.vat_amount,
                  is_issued: (settlementInvoice as any).is_issued || false,
                  customer_id: settlementInvoice.customer_id,
                }
              : null
          }
        />
      </div>
    </div>
  );
};

export default Invoices;
