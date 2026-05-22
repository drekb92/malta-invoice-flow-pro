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
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  Mail,
  MessageCircle,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
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
import { useRecurringSourceInvoiceIds } from "@/hooks/useRecurringInvoices";

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
  source_recurring_id?: string | null;
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
  const [searchParams] = useSearchParams();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  // Initialise from URL: ?status=paid|unpaid|overdue|draft|needsSending
  const [statusFilter, setStatusFilter] = useState(() => {
    if (searchParams.get("needsSending") === "true") return "needsSending";
    const status = searchParams.get("status");
    return status || "all";
  });
  // Initialise aging bucket from URL: ?aging=1-30|31-60|61-90|90+
  const [agingFilter] = useState(() => searchParams.get("aging") || "all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { data: recurringSourceIds } = useRecurringSourceInvoiceIds(user?.id);

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

  // Bulk selection & sorting
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sortField, setSortField] = useState<"invoice_date" | "total_amount" | "status" | "customer" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkPaidConfirm, setShowBulkPaidConfirm] = useState(false);
  const [bulkPaidDate, setBulkPaidDate] = useState(format(new Date(), "yyyy-MM-dd"));

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
          invoice.invoice_number?.toLowerCase().includes(term) ||
          invoice.customers?.name?.toLowerCase().includes(term) ||
          invoice.total_amount?.toString().includes(term),
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      const todayStr = new Date().toISOString().split("T")[0];

      if (statusFilter === "issued") {
        // Malta-issued documents that are still open
        filtered = filtered.filter(
          (invoice) => (invoice as any).is_issued && invoice.status !== "paid" && invoice.status !== "credited",
        );
      } else if (statusFilter === "overdue") {
        // Past due date and not settled — covers both explicit "overdue" status and computed overdue
        filtered = filtered.filter(
          (invoice) =>
            invoice.status === "overdue" ||
            (invoice.due_date < todayStr &&
              invoice.status !== "paid" &&
              invoice.status !== "credited" &&
              invoice.status !== "cancelled" &&
              invoice.status !== "draft"),
        );
      } else if (statusFilter === "unpaid") {
        // Outstanding — anything not yet paid, not a draft, and not voided
        filtered = filtered.filter(
          (invoice) =>
            invoice.status !== "paid" &&
            invoice.status !== "draft" &&
            invoice.status !== "credited" &&
            invoice.status !== "cancelled",
        );
      } else if (statusFilter === "needsSending") {
        // Issued/finalised documents that haven't been sent to the customer yet
        filtered = filtered.filter((invoice) => invoice.status !== "draft" && !invoice.last_sent_at);
      } else if (statusFilter === "recurringDraft") {
        // Draft invoices generated by a recurring schedule, awaiting review
        filtered = filtered.filter((invoice) => invoice.status === "draft" && !!invoice.source_recurring_id);
      } else {
        filtered = filtered.filter((invoice) => invoice.status === statusFilter);
      }
    }

    // Further narrow by aging bucket (e.g. when arriving from Receivables Aging card)
    if (agingFilter !== "all") {
      const today = new Date();
      const agingRanges: Record<string, [number, number]> = {
        "1-30": [1, 30],
        "31-60": [31, 60],
        "61-90": [61, 90],
        "90+": [91, Infinity],
      };
      const range = agingRanges[agingFilter];
      if (range) {
        filtered = filtered.filter((invoice) => {
          const dueDate = new Date(invoice.due_date);
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysOverdue >= range[0] && daysOverdue <= range[1];
        });
      }
    }

    setFilteredInvoices(filtered);
  }, [searchTerm, statusFilter, agingFilter, invoices]);

  // Sorted view of filteredInvoices
  const sortedInvoices = useMemo(() => {
    if (!sortField) return filteredInvoices;
    return [...filteredInvoices].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      if (sortField === "invoice_date") {
        aVal = a.invoice_date || a.created_at;
        bVal = b.invoice_date || b.created_at;
      } else if (sortField === "total_amount") {
        aVal = a.total_amount || a.amount || 0;
        bVal = b.total_amount || b.amount || 0;
      } else if (sortField === "status") {
        aVal = a.status;
        bVal = b.status;
      } else {
        aVal = a.customers?.name || "";
        bVal = b.customers?.name || "";
      }
      if (typeof aVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredInvoices, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const allSelected = sortedInvoices.length > 0 && sortedInvoices.every((inv) => selectedIds.has(inv.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedInvoices.map((inv) => inv.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Invoices visible in the table (pending-delete ones are hidden optimistically)
  const displayedInvoices = useMemo(
    () => sortedInvoices.filter((inv) => !pendingDeleteIds.has(inv.id)),
    [sortedInvoices, pendingDeleteIds],
  );

  const bulkPaidEligible = useMemo(
    () =>
      displayedInvoices.filter(
        (inv) => selectedIds.has(inv.id) && inv.status !== "paid" && inv.status !== "draft" && (inv as any).is_issued,
      ),
    [displayedInvoices, selectedIds],
  );

  const bulkPaidSkipped = useMemo(
    () => Array.from(selectedIds).filter((id) => !bulkPaidEligible.some((inv) => inv.id === id)).length,
    [selectedIds, bulkPaidEligible],
  );

  const handleBulkMarkPaid = async () => {
    if (!user || bulkPaidEligible.length === 0) return;
    setBulkLoading(true);
    try {
      for (const inv of bulkPaidEligible) {
        await supabase.from("payments").insert({
          user_id: user.id,
          invoice_id: inv.id,
          amount: inv.total_amount || inv.amount,
          payment_date: bulkPaidDate,
          method: "bank_transfer",
        });
        await supabase.from("invoices").update({ status: "paid" }).eq("id", inv.id).eq("user_id", user.id);
      }
      toast({ title: `${bulkPaidEligible.length} invoice${bulkPaidEligible.length !== 1 ? "s" : ""} marked as paid` });
      setSelectedIds(new Set());
      setShowBulkPaidConfirm(false);
      fetchInvoices();
    } catch {
      toast({ title: "Error", description: "Failed to mark invoices as paid", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUndoDelete = () => {
    if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
    setPendingDeleteIds(new Set());
  };

  const handleBulkDeleteDrafts = async () => {
    if (!user) return;
    setBulkLoading(true);
    try {
      const drafts = sortedInvoices.filter(
        (inv) => selectedIds.has(inv.id) && inv.status === "draft" && !(inv as any).is_issued,
      );
      if (drafts.length === 0) {
        toast({ title: "No drafts selected", description: "Only draft invoices can be deleted in bulk." });
        setBulkLoading(false);
        return;
      }
      const draftIds = new Set(drafts.map((d) => d.id));

      // Optimistic: hide them immediately, delete from DB after delay
      setPendingDeleteIds(draftIds);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);

      toast({
        title: `${drafts.length} draft${drafts.length !== 1 ? "s" : ""} deleted`,
        action: <ToastAction altText="Undo" onClick={handleUndoDelete}>Undo</ToastAction>,
      });

      pendingDeleteTimerRef.current = setTimeout(async () => {
        for (const id of draftIds) {
          await supabase.from("invoices").delete().eq("id", id).eq("user_id", user.id);
        }
        setPendingDeleteIds(new Set());
        fetchInvoices();
      }, 6000);
    } catch {
      toast({ title: "Error", description: "Failed to delete drafts", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDownloadPDFs = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleDownloadPDF(id);
      await new Promise((r) => setTimeout(r, 600));
    }
    setSelectedIds(new Set());
  };

  // Exit selection mode on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionMode) {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSelectionMode]);

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
        icon: null,
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
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 border-r border-border pr-3 mr-1">
                  <Button variant="outline" size="sm" onClick={() => navigate("/imports/invoices")}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/exports/invoices")}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
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
                <Button
                  variant={statusFilter !== "all" || agingFilter !== "all" ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter ({
                    statusFilter === "all" ? "All" :
                    statusFilter === "needsSending" ? "Needs Sending" :
                    statusFilter === "recurringDraft" ? "Recurring Pending" :
                    statusFilter === "unpaid" ? "Unpaid" :
                    statusFilter === "overdue" ? "Overdue" :
                    statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)
                  }){agingFilter !== "all" ? ` · ${agingFilter}d` : ""}
                  {(statusFilter !== "all" || agingFilter !== "all") && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setStatusFilter("all"); }}
                      className="ml-1 rounded-full hover:bg-white/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border border-border z-50">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Invoices</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("issued")}>Issued</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("unpaid")}>Unpaid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("paid")}>Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>Overdue</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("needsSending")}>Needs Sending</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("recurringDraft")}>Recurring Pending</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("credited")}>Credited</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="border-l border-border pl-4 ml-auto">
              <Button
                variant={isSelectionMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  const next = !isSelectionMode;
                  setIsSelectionMode(next);
                  if (!next) setSelectedIds(new Set());
                }}
              >
                {isSelectionMode ? "Cancel" : "Select"}
              </Button>
            </div>
          </div>

          {/* Invoices Table */}
          <Card>
            <CardContent className="p-0">
              {/* Bulk action bar — only in selection mode */}
              {isSelectionMode && selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border-b-2 border-primary/20">
                  <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setBulkPaidDate(format(new Date(), "yyyy-MM-dd"));
                        setShowBulkPaidConfirm(true);
                      }}
                    >
                      <Wallet className="h-3.5 w-3.5 mr-1.5" />
                      Mark Paid
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleBulkDownloadPDFs}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download PDFs
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-600 hover:text-red-700 border-red-200"
                      onClick={() => setShowBulkDeleteConfirm(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete Drafts
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                  <TableRow>
                    {isSelectionMode && (
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={allSelected}
                          data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                          className="translate-y-px"
                        />
                      </TableHead>
                    )}
                    <TableHead className="pl-4">Invoice #</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort("customer")}
                        className="flex items-center hover:text-foreground transition-colors"
                      >
                        Customer
                        {sortField === "customer" ? (
                          sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        onClick={() => handleSort("total_amount")}
                        className="flex items-center ml-auto hover:text-foreground transition-colors"
                      >
                        Amount
                        {sortField === "total_amount" ? (
                          sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort("status")}
                        className="flex items-center hover:text-foreground transition-colors"
                      >
                        Status
                        {sortField === "status" ? (
                          sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort("invoice_date")}
                        className="flex items-center hover:text-foreground transition-colors"
                      >
                        Issue Date
                        {sortField === "invoice_date" ? (
                          sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={isSelectionMode ? 8 : 7} className="text-center py-8 text-muted-foreground text-sm">
                        Loading invoices…
                      </TableCell>
                    </TableRow>
                  ) : displayedInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSelectionMode ? 8 : 7}>
                        {searchTerm || statusFilter !== "all" ? (
                          <div className="flex flex-col items-center gap-3 py-14 text-center">
                            <div className="rounded-full bg-muted p-4">
                              <Search className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">No results found</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                No invoices match{" "}
                                {statusFilter !== "all"
                                  ? `the "${statusFilter === "needsSending" ? "Needs Sending" : statusFilter}" filter`
                                  : "your search"}
                                {searchTerm && statusFilter !== "all" ? " and search" : ""}.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setStatusFilter("all"); }}
                              className="text-xs text-primary underline underline-offset-2"
                            >
                              Clear filters
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <div className="rounded-full bg-muted p-4">
                              <Plus className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">No invoices yet</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Create your first Malta VAT-compliant invoice and start getting paid</p>
                            </div>
                            <Button asChild size="sm">
                              <Link to="/invoices/new">
                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                New Invoice
                              </Link>
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedInvoices.map((invoice) => {
                      const totalAmount = invoice.total_amount || invoice.amount || 0;
                      const statusBadge = getStatusBadge(invoice);
                      const StatusIcon = statusBadge.icon;

                      return (
                        <TableRow key={invoice.id} className="group hover:bg-muted/50">
                          {isSelectionMode && (
                            <TableCell className="pl-4 w-10">
                              <Checkbox
                                checked={selectedIds.has(invoice.id)}
                                onCheckedChange={() => toggleSelect(invoice.id)}
                                aria-label={`Select ${invoice.invoice_number}`}
                                className="translate-y-px"
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium pl-4">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-left hover:text-primary transition-colors group"
                              onClick={() => setSettlementInvoice(invoice)}
                            >
                              <span className="group-hover:underline">{invoice.invoice_number}</span>
                              {(invoice as any).is_issued && (
                                <span title="Officially issued — cannot be edited">
                                  <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                </span>
                              )}
                              {recurringSourceIds?.has(invoice.id) && (
                                <span title="Recurring invoice">
                                  <RefreshCw className="h-3 w-3 text-primary" />
                                </span>
                              )}
                              {invoice.source_recurring_id && invoice.status === "draft" && (
                                <Badge variant="outline" className="text-xs py-0 px-1.5 h-4 border-amber-400 text-amber-700 dark:text-amber-300">
                                  Recurring
                                </Badge>
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{invoice.customers?.name || "Unknown Customer"}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(totalAmount)}
                            {Number(invoice.discount_value || 0) > 0 && (
                              <Badge variant="secondary" className="text-xs ml-2">disc</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge className={`${statusBadge.className} w-fit whitespace-nowrap pointer-events-none`}>
                                <span className="flex items-center gap-1.5">
                                  {StatusIcon && <StatusIcon className="h-3 w-3" />}
                                  {statusBadge.label}
                                </span>
                              </Badge>
                              {invoice.last_sent_at && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-muted-foreground cursor-default">
                                        {invoice.last_sent_channel === "whatsapp"
                                          ? <MessageCircle className="h-3 w-3" />
                                          : <Mail className="h-3 w-3" />}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        Sent {format(new Date(invoice.last_sent_at), "dd MMM")} via{" "}
                                        {invoice.last_sent_channel === "whatsapp" ? "WhatsApp" : "Email"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(invoice.invoice_date || invoice.created_at), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{format(new Date(invoice.due_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {invoice.status !== "paid" &&
                                invoice.status !== "credited" &&
                                invoice.status !== "draft" &&
                                invoice.status !== "cancelled" &&
                                (invoice as any).is_issued && (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
                                  </div>
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
                                  {(invoice as any).is_issued && (
                                    <DropdownMenuItem asChild>
                                      <Link to={`/invoices/${invoice.id}?recurring=1`}>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        {recurringSourceIds?.has(invoice.id) ? "Manage recurring" : "Set as recurring"}
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
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
                                      Officially issued — read only
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
              template?.font_family || "Figtree",
            )}:wght@300;400;500;600;700;800;900&display=swap`}
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
                  fontFamily: template.font_family,
                  fontSize: template.font_size,
                  layout: template?.layout || "default",
                  headerLayout: template?.header_layout || "default",
                  tableStyle: template?.table_style || "default",
                  totalsStyle: template?.totals_style || "default",
                  bankingVisibility: template?.banking_visibility !== false,
                  bankingStyle: template?.banking_style || "default",
                  style: template?.style || "modern",
                  notesVisibility: (template as any)?.notes_visibility !== false,
                  includeVatBreakdown: invoiceSettings?.include_vat_breakdown ?? true,
                  includePaymentInstructions: invoiceSettings?.include_payment_instructions ?? true,
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
                notesText={(exportInvoice as any)?.notes || undefined}
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

        {/* Bulk Mark as Paid — review dialog */}
        <Dialog open={showBulkPaidConfirm} onOpenChange={setShowBulkPaidConfirm}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Mark as Paid</DialogTitle>
              <DialogDescription>
                Confirm payment for the invoices below. Each will be recorded at its full outstanding amount.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Payment date */}
              <div className="grid gap-1.5">
                <Label htmlFor="bulk_paid_date">Payment date</Label>
                <Input
                  id="bulk_paid_date"
                  type="date"
                  value={bulkPaidDate}
                  onChange={(e) => setBulkPaidDate(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Invoice list */}
              {bulkPaidEligible.length > 0 ? (
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left font-medium text-muted-foreground px-3 py-2">Invoice</th>
                        <th className="text-left font-medium text-muted-foreground px-3 py-2">Customer</th>
                        <th className="text-right font-medium text-muted-foreground px-3 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPaidEligible.map((inv, i) => (
                        <tr key={inv.id} className={i < bulkPaidEligible.length - 1 ? "border-b border-border/60" : ""}>
                          <td className="px-3 py-2 font-medium tabular-nums">{inv.invoice_number}</td>
                          <td className="px-3 py-2 text-muted-foreground">{inv.customers?.name || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatCurrency(inv.total_amount || inv.amount || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-muted/30">
                        <td colSpan={2} className="px-3 py-2 text-sm font-medium">
                          Total — {bulkPaidEligible.length} invoice{bulkPaidEligible.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {formatCurrency(bulkPaidEligible.reduce((s, inv) => s + (inv.total_amount || inv.amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No eligible invoices in your selection. Only issued, unpaid invoices can be marked as paid.
                </p>
              )}

              {/* Skipped notice */}
              {bulkPaidSkipped > 0 && (
                <p className="text-xs text-muted-foreground">
                  {bulkPaidSkipped} invoice{bulkPaidSkipped !== 1 ? "s" : ""} in your selection will be skipped
                  (drafts, already paid, or not yet issued).
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowBulkPaidConfirm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleBulkMarkPaid}
                disabled={bulkLoading || bulkPaidEligible.length === 0}
              >
                {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Mark {bulkPaidEligible.length} as Paid
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Drafts confirm */}
        <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle>Delete Drafts</DialogTitle>
              <DialogDescription>
                Permanently delete all selected draft invoices? Only drafts will be removed — issued invoices are
                unaffected. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowBulkDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleBulkDeleteDrafts} disabled={bulkLoading}>
                {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
