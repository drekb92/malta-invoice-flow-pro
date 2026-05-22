import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  MoreHorizontal,
  Eye,
  Edit,
  Mail,
  ArrowRight,
  Trash2,
  Calendar as CalendarIcon,
  Download,
  MessageCircle,
  Loader2,
  Send,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { TransactionDrawer } from "@/components/TransactionDrawer";
import { UnifiedInvoiceLayout, InvoiceData } from "@/components/UnifiedInvoiceLayout";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { downloadPdfFromFunction, buildA4HtmlDocument, inlineImages, captureCssVars } from "@/lib/edgePdf";
import { SendDocumentEmailDialog } from "@/components/SendDocumentEmailDialog";
import { useInvoiceSettings } from "@/hooks/useInvoiceSettings";
import { normalisePhone } from "@/hooks/useWhatsApp";

interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  issue_date: string;
  valid_until: string;
  status: string;
  created_at: string;
  customers?: {
    name: string;
    email?: string;
    address?: string;
    vat_number?: string;
    payment_terms: string | null;
    phone?: string | null;
  };
}

const Quotations = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [filtered, setFiltered] = useState<Quotation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [dateOption, setDateOption] = useState<"quotation" | "today" | "custom">("quotation");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [isConverting, setIsConverting] = useState(false);
  const [drawerQuotation, setDrawerQuotation] = useState<Quotation | null>(null);
  const [pdfQuotationData, setPdfQuotationData] = useState<InvoiceData | null>(null);
  const [pdfInvoiceData, setPdfInvoiceData] = useState<InvoiceData | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailQuotation, setEmailQuotation] = useState<Quotation | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState<string | null>(null);
  const [isConvertingAndSending, setIsConvertingAndSending] = useState(false);

  // Selection mode & sorting
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sortField, setSortField] = useState<"issue_date" | "total_amount" | "status" | "customer" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { template } = useInvoiceTemplate();
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();
  const { settings: invoiceSettings } = useInvoiceSettings();

  // ── Shared settings builders ───────────────────────────────────────────────
  const buildCompanySettings = () =>
    companySettings
      ? {
          name: companySettings.company_name,
          email: companySettings.company_email,
          phone: companySettings.company_phone,
          address: companySettings.company_address,
          addressLine1: companySettings.company_address_line1 || undefined,
          addressLine2: companySettings.company_address_line2 || undefined,
          locality: companySettings.company_locality || undefined,
          postCode: companySettings.company_post_code || undefined,
          city: companySettings.company_city,
          state: companySettings.company_state,
          zipCode: companySettings.company_zip_code,
          country: companySettings.company_country,
          taxId: companySettings.company_vat_number,
          registrationNumber: companySettings.company_registration_number,
          logo: companySettings.company_logo,
        }
      : undefined;

  const buildBankingSettings = () =>
    bankingSettings
      ? {
          bankName: bankingSettings.bank_name,
          accountName: bankingSettings.bank_account_name,
          swiftCode: bankingSettings.bank_swift_code,
          iban: bankingSettings.bank_iban,
        }
      : undefined;

  const buildTemplateSettings = () =>
    template
      ? {
          primaryColor: template.primary_color,
          fontFamily: template.font_family,
          fontSize: template.font_size,
          layout: template.layout as any,
          headerLayout: template.header_layout as any,
          tableStyle: template.table_style as any,
          totalsStyle: template.totals_style as any,
          bankingVisibility: template.banking_visibility,
          bankingStyle: template.banking_style as any,
          marginTop: template.margin_top,
          marginRight: template.margin_right,
          marginBottom: template.margin_bottom,
          marginLeft: template.margin_left,
          style: (template.style as any) || "modern",
        }
      : undefined;

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchQuotations = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("quotations")
        .select(`*, customers(name, email, address, vat_number, payment_terms, phone)`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const today = new Date().toISOString().split("T")[0];
      const toExpire = (data || []).filter(
        (q) => q.valid_until < today && !["accepted", "converted", "expired"].includes(q.status),
      );

      let finalList: typeof data;
      if (toExpire.length > 0) {
        await supabase
          .from("quotations")
          .update({ status: "expired" })
          .in(
            "id",
            toExpire.map((q) => q.id),
          );
        const expiredIds = new Set(toExpire.map((q) => q.id));
        finalList = (data || []).map((q) => (expiredIds.has(q.id) ? { ...q, status: "expired" } : q));
      } else {
        finalList = data || [];
      }

      setQuotations(finalList);
      setFiltered(finalList);

      // Auto-open drawer for a newly created quotation
      const createdId = new URLSearchParams(window.location.search).get("created");
      if (createdId) {
        const found = finalList.find((q) => q.id === createdId);
        if (found) setDrawerQuotation(found);
        setSearchParams({}, { replace: true });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to load quotations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [user]);

  useEffect(() => {
    let list = quotations;
    if (searchTerm) {
      list = list.filter(
        (q) =>
          q.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.total_amount?.toString().includes(searchTerm),
      );
    }
    if (statusFilter !== "all") list = list.filter((q) => q.status === statusFilter);
    setFiltered(list);
  }, [searchTerm, statusFilter, quotations]);

  const sortedQuotations = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      if (sortField === "issue_date") { aVal = a.issue_date || a.created_at; bVal = b.issue_date || b.created_at; }
      else if (sortField === "total_amount") { aVal = a.total_amount || a.amount || 0; bVal = b.total_amount || b.amount || 0; }
      else if (sortField === "status") { aVal = a.status; bVal = b.status; }
      else { aVal = a.customers?.name || ""; bVal = b.customers?.name || ""; }
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filtered, sortField, sortDir]);

  const displayedQuotations = useMemo(
    () => sortedQuotations.filter((q) => !pendingDeleteIds.has(q.id)),
    [sortedQuotations, pendingDeleteIds],
  );

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const allSelected = displayedQuotations.length > 0 && displayedQuotations.every((q) => selectedIds.has(q.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayedQuotations.map((q) => q.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleUndoDelete = () => {
    if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
    setPendingDeleteIds(new Set());
  };

  const handleBulkDeleteQuotations = async () => {
    if (!user) return;
    setBulkLoading(true);
    try {
      const drafts = displayedQuotations.filter((q) => selectedIds.has(q.id) && q.status === "draft");
      if (drafts.length === 0) {
        toast({ title: "No drafts selected", description: "Only draft quotations can be deleted in bulk." });
        setBulkLoading(false);
        return;
      }
      const draftIds = new Set(drafts.map((d) => d.id));
      setPendingDeleteIds(draftIds);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      toast({
        title: `${drafts.length} draft${drafts.length !== 1 ? "s" : ""} deleted`,
        action: <ToastAction altText="Undo" onClick={handleUndoDelete}>Undo</ToastAction>,
      });
      pendingDeleteTimerRef.current = setTimeout(async () => {
        for (const id of draftIds) {
          await supabase.from("quotations").delete().eq("id", id).eq("user_id", user.id);
        }
        setPendingDeleteIds(new Set());
        fetchQuotations();
      }, 6000);
    } catch {
      toast({ title: "Error", description: "Failed to delete drafts", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDownloadPDFs = async () => {
    const toDownload = displayedQuotations.filter((q) => selectedIds.has(q.id));
    for (const q of toDownload) {
      await handleDownloadPdf(q);
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      converted: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return variants[status] || variants.draft;
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("quotations").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Quotation removed." });
      fetchQuotations();
    } catch {
      toast({ title: "Error", description: "Failed to delete quotation", variant: "destructive" });
    }
  };

  // ── Build InvoiceData for a quotation (shared by PDF + email + WhatsApp) ──
  const buildQuotationInvoiceData = async (quotation: Quotation): Promise<InvoiceData> => {
    const { data: items, error: itemsError } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotation.id);

    if (itemsError) throw itemsError;

    return {
      invoiceNumber: quotation.quotation_number,
      invoiceDate: quotation.issue_date || quotation.created_at,
      dueDate: quotation.valid_until || quotation.issue_date || quotation.created_at,
      customer: {
        name: quotation.customers?.name || "Unknown Customer",
        email: quotation.customers?.email,
        address: quotation.customers?.address,
        vat_number: quotation.customers?.vat_number,
      },
      items: (items || []).map((item) => ({
        description: item.description,
        quantity: item.quantity || 1,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate || 0.18,
        unit: item.unit || "unit",
      })),
      totals: {
        netTotal: quotation.amount || 0,
        vatTotal: quotation.vat_amount || 0,
        grandTotal: quotation.total_amount || quotation.amount || 0,
      },
    };
  };

  // ── PDF download ──────────────────────────────────────────────────────────
  const handleDownloadPdf = async (quotation: Quotation) => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const data = await buildQuotationInvoiceData(quotation);
      setPdfQuotationData(data);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await downloadPdfFromFunction(`Quotation-${quotation.quotation_number}`, template?.font_family);
      toast({ title: "Success", description: "PDF downloaded successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to download PDF", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
      setPdfQuotationData(null);
    }
  };

  // ── Email send ─────────────────────────────────────────────────────────────
  const handleSendEmail = (quotation: Quotation) => {
    setEmailQuotation(quotation);
    (async () => {
      const data = await buildQuotationInvoiceData(quotation);
      setPdfQuotationData(data);
      await new Promise((resolve) => setTimeout(resolve, 100));
      setShowEmailDialog(true);
    })();
  };

  // ── WhatsApp send (fixed: phone pre-filled, message URL-encoded) ──────────
  const handleSendWhatsApp = async (quotation: Quotation) => {
    if (!user || whatsappLoading) return;
    setWhatsappLoading(quotation.id);

    try {
      const data = await buildQuotationInvoiceData(quotation);
      setPdfQuotationData(data);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const root = document.getElementById("invoice-preview-root") as HTMLElement | null;
      if (!root) throw new Error("Document preview not found");

      const cloned = root.cloneNode(true) as HTMLElement;
      await inlineImages(cloned);
      const cssVars = captureCssVars(root);
      if (cssVars) {
        const existing = cloned.getAttribute("style") || "";
        cloned.setAttribute("style", `${existing}${existing ? " " : ""}${cssVars}`);
      }

      const html = buildA4HtmlDocument({
        filename: `Quotation-${quotation.quotation_number}`,
        fontFamily: template?.font_family || "Figtree",
        clonedRoot: cloned,
      });

      const { data: shareData, error } = await supabase.functions.invoke("create-document-share-link", {
        body: {
          html,
          filename: `Quotation-${quotation.quotation_number}`,
          userId: user.id,
          documentType: "quotation",
          documentId: quotation.id,
          documentNumber: quotation.quotation_number,
          customerId: quotation.customer_id,
        },
      });

      if (error) throw error;
      if (shareData?.error) throw new Error(shareData.error);

      const shareUrl = shareData.url;
      const amountStr = formatCurrency(quotation.total_amount || quotation.amount || 0);
      const validUntilStr = quotation.valid_until ? format(new Date(quotation.valid_until), "dd/MM/yyyy") : "N/A";

      const message =
        `Hi ${quotation.customers?.name || ""},\n\n` +
        `Please find your Quotation *${quotation.quotation_number}* for ${amountStr}.\n\n` +
        `Valid until: ${validUntilStr}\n\n` +
        `View / download PDF:\n${shareUrl}\n\n` +
        `Let us know if you'd like to proceed or have any questions.\n\n` +
        `${companySettings?.company_name || ""}`;

      // Pre-fill phone number if available
      const phone = normalisePhone(quotation.customers?.phone || "");
      const whatsappUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      const waWindow = window.open(`/redirect?url=${encodeURIComponent(whatsappUrl)}`, "_blank");
      if (!waWindow) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site and try again.",
          variant: "destructive",
        });
        return;
      }

      // Mark as sent if currently draft
      if (quotation.status === "draft") {
        await supabase.from("quotations").update({ status: "sent" }).eq("id", quotation.id);
        setQuotations((prev) => prev.map((q) => (q.id === quotation.id ? { ...q, status: "sent" } : q)));
        setFiltered((prev) => prev.map((q) => (q.id === quotation.id ? { ...q, status: "sent" } : q)));
      }

      toast({ title: "WhatsApp opened", description: "Share link created and WhatsApp opened." });
    } catch (error: any) {
      console.error("[Quotations] WhatsApp share error:", error);
      toast({
        title: "Failed to create share link",
        description: error.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setWhatsappLoading(null);
      setPdfQuotationData(null);
    }
  };

  // ── Invoice number generation ──────────────────────────────────────────────
  const generateNextInvoiceNumber = async (): Promise<string> => {
    const { data: settingsRow } = await supabase
      .from("invoice_settings")
      .select("numbering_prefix")
      .eq("user_id", user!.id)
      .maybeSingle();

    const prefix = (settingsRow as any)?.numbering_prefix || "INV-";
    const { data, error } = await supabase.rpc("next_invoice_number", {
      p_business_id: user!.id,
      p_prefix: prefix,
    });

    if (error) throw error;
    if (!data) throw new Error("Failed to generate invoice number");
    return data;
  };

  // ── Convert to invoice ─────────────────────────────────────────────────────
  const handleConvertToInvoice = async (quotationId: string, invoiceDateOverride?: Date) => {
    try {
      const { data: qData, error: qErr } = await supabase
        .from("quotations")
        .select(`*, customers(payment_terms), quotation_items(description, quantity, unit, unit_price, vat_rate)`)
        .eq("id", quotationId)
        .single();

      if (qErr) throw qErr;

      const invoiceNumber = await generateNextInvoiceNumber();
      const baseDateObj = invoiceDateOverride
        ? new Date(invoiceDateOverride)
        : new Date(qData.issue_date || qData.created_at);
      const paymentTerms = qData.customers?.payment_terms || "Net 30";
      const daysMatch = paymentTerms.match(/\d+/);
      const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
      const dueDate = addDays(baseDateObj, paymentDays);

      const invoicePayload: TablesInsert<"invoices"> = {
        invoice_number: invoiceNumber,
        customer_id: qData.customer_id,
        amount: qData.amount,
        vat_amount: qData.vat_amount,
        total_amount: qData.total_amount,
        invoice_date: baseDateObj.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        status: "draft",
        user_id: (qData as any).user_id,
        discount_type: "amount",
        discount_value: 0,
        discount_reason: "",
        vat_rate: qData.vat_rate || 0.18,
      };

      const { data: inv, error: invErr } = await supabase.from("invoices").insert(invoicePayload).select("id").single();
      if (invErr) throw invErr;

      const itemsPayload = (qData.quotation_items || []).map((it: any) => ({
        invoice_id: inv.id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
      }));

      if (itemsPayload.length > 0) {
        const { error: itemsErr } = await supabase.from("invoice_items").insert(itemsPayload);
        if (itemsErr) throw itemsErr;
      }

      const { error: updErr } = await supabase
        .from("quotations")
        .update({ status: "converted" })
        .eq("id", quotationId)
        .eq("user_id", user!.id);

      if (updErr) throw updErr;

      toast({ title: "Converted to Invoice", description: "Quotation converted to invoice." });
      navigate("/invoices");
      fetchQuotations();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to convert quotation", variant: "destructive" });
      throw e;
    }
  };

  const openConvertDialog = (q: Quotation) => {
    setSelectedQuotation(q);
    setDateOption("quotation");
    setCustomDate(undefined);
    setConvertDialogOpen(true);
  };

  const handleConvertAndSendFromDialog = async () => {
    if (!selectedQuotation) return;
    if (dateOption === "custom" && !customDate) {
      toast({ title: "Select a date", description: "Please choose a valid custom date.", variant: "destructive" });
      return;
    }
    setIsConvertingAndSending(true);
    try {
      const override = dateOption === "today" ? new Date() : dateOption === "custom" ? customDate : undefined;
      await handleConvertAndSend(selectedQuotation.id, override);
      setConvertDialogOpen(false);
      setSelectedQuotation(null);
    } finally {
      setIsConvertingAndSending(false);
    }
  };

  const confirmConvert = async () => {
    if (!selectedQuotation) return;
    if (dateOption === "custom" && !customDate) {
      toast({ title: "Select a date", description: "Please choose a valid custom date.", variant: "destructive" });
      return;
    }
    setIsConverting(true);
    try {
      const override = dateOption === "today" ? new Date() : dateOption === "custom" ? customDate : undefined;
      await handleConvertToInvoice(selectedQuotation.id, override);
      setConvertDialogOpen(false);
      setSelectedQuotation(null);
    } finally {
      setIsConverting(false);
    }
  };

  const handleConvertAndSend = async (quotationId: string, invoiceDateOverride?: Date) => {
    if (!user) return;
    try {
      const { data: qData, error: qErr } = await supabase
        .from("quotations")
        .select(
          `*, customers(name, email, address, vat_number, payment_terms), quotation_items(description, quantity, unit, unit_price, vat_rate)`,
        )
        .eq("id", quotationId)
        .single();

      if (qErr) throw qErr;

      const customerEmail = qData.customers?.email;
      if (!customerEmail) {
        toast({
          title: "No email address",
          description: "This customer has no email address. Please add one before sending.",
          variant: "destructive",
        });
        return;
      }

      const invoiceNumber = await generateNextInvoiceNumber();
      const baseDateObj = invoiceDateOverride ? new Date(invoiceDateOverride) : new Date();
      const paymentTerms = qData.customers?.payment_terms || "Net 30";
      const daysMatch = paymentTerms.match(/\d+/);
      const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
      const dueDate = addDays(baseDateObj, paymentDays);

      const invoicePayload: TablesInsert<"invoices"> = {
        invoice_number: invoiceNumber,
        customer_id: qData.customer_id,
        amount: qData.amount,
        vat_amount: qData.vat_amount,
        total_amount: qData.total_amount,
        invoice_date: baseDateObj.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        status: "draft",
        is_issued: false,
        issued_at: null,
        user_id: (qData as any).user_id,
        discount_type: "amount",
        discount_value: 0,
        discount_reason: "",
        vat_rate: qData.vat_rate || 0.18,
      };

      const { data: inv, error: invErr } = await supabase.from("invoices").insert(invoicePayload).select("id").single();
      if (invErr) throw invErr;

      const itemsPayload = (qData.quotation_items || []).map((it: any) => ({
        invoice_id: inv.id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
      }));

      if (itemsPayload.length > 0) {
        const { error: itemsErr } = await supabase.from("invoice_items").insert(itemsPayload);
        if (itemsErr) throw itemsErr;
      }

      const { invoiceService } = await import("@/services/invoiceService");
      const invoiceHash = await invoiceService.generateInvoiceHash(inv.id, invoiceNumber);

      const { error: finalizeErr } = await supabase
        .from("invoices")
        .update({ status: "sent", is_issued: true, issued_at: new Date().toISOString(), invoice_hash: invoiceHash })
        .eq("id", inv.id);
      if (finalizeErr) throw finalizeErr;

      const newInvoiceData: InvoiceData = {
        invoiceNumber,
        invoiceDate: baseDateObj.toISOString().split("T")[0],
        dueDate: dueDate.toISOString().split("T")[0],
        customer: {
          name: qData.customers?.name || "Unknown Customer",
          email: qData.customers?.email,
          address: qData.customers?.address,
          vat_number: qData.customers?.vat_number,
        },
        items: (qData.quotation_items || []).map((item: any) => ({
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate || 0.18,
          unit: item.unit || "unit",
        })),
        totals: {
          netTotal: qData.amount || 0,
          vatTotal: qData.vat_amount || 0,
          grandTotal: qData.total_amount || qData.amount || 0,
        },
      };

      setPdfInvoiceData(newInvoiceData);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const root = document.getElementById("invoice-send-root") as HTMLElement | null;
      if (!root) throw new Error("PDF render container not found");

      const { buildA4HtmlDocument } = await import("@/lib/edgePdf");
      const html = buildA4HtmlDocument({
        filename: `Invoice-${invoiceNumber}`,
        fontFamily: template?.font_family || "Figtree",
        clonedRoot: root.cloneNode(true) as HTMLElement,
      });

      const { error: sendError } = await supabase.functions.invoke("send-document-email", {
        body: {
          to: customerEmail,
          subject: `Invoice ${invoiceNumber} from ${companySettings?.company_name || ""}`,
          messageHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <p style="margin: 0 0 10px 0;">Dear ${qData.customers?.name || "Customer"},</p>
            <p style="margin: 0 0 10px 0;">&nbsp;</p>
            <p style="margin: 0 0 10px 0;">Please find attached invoice ${invoiceNumber}.</p>
            <p style="margin: 0 0 10px 0;">&nbsp;</p>
            <p style="margin: 0 0 10px 0;">If you have any questions, please don't hesitate to contact us.</p>
            <p style="margin: 0 0 10px 0;">&nbsp;</p>
            <p style="margin: 0 0 10px 0;">Best regards,</p>
            <p style="margin: 0 0 10px 0;">${companySettings?.company_name || ""}</p>
          </div>`,
          filename: `Invoice-${invoiceNumber}`,
          html,
          userId: user.id,
          documentType: "invoice",
          documentId: inv.id,
          documentNumber: invoiceNumber,
          customerId: qData.customer_id,
        },
      });

      if (sendError) throw sendError;

      await supabase.from("quotations").update({ status: "converted" }).eq("id", quotationId).eq("user_id", user.id);

      toast({ title: "Invoice sent!", description: `Invoice ${invoiceNumber} sent to ${customerEmail}.` });
      fetchQuotations();
      navigate(`/invoices/${inv.id}`);
    } catch (e: any) {
      console.error("[ConvertAndSend] Error:", e);
      toast({ title: "Error", description: e?.message || "Failed to convert and send", variant: "destructive" });
    } finally {
      setPdfInvoiceData(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
                <p className="text-muted-foreground">Create and manage quotations for potential customers</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button asChild>
                  <Link to="/quotations/new">
                    <Plus className="h-4 w-4 mr-2" />
                    New Quotation
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search quotations..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={statusFilter !== "all" ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter (
                  {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)})
                  {statusFilter !== "all" && (
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
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Quotations</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("sent")}>Sent</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("accepted")}>Accepted</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("converted")}>Converted to Invoice</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("expired")}>Expired</DropdownMenuItem>
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

          <Card>
            <CardContent className="p-0">
              {isSelectionMode && selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b border-border">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkDownloadPDFs}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download PDFs
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:text-red-700 border-red-200" onClick={() => setShowBulkDeleteConfirm(true)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete Drafts
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
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
                    <TableHead className="pl-4">Quotation #</TableHead>
                    <TableHead>
                      <button type="button" onClick={() => handleSort("customer")} className="flex items-center hover:text-foreground transition-colors">
                        Customer
                        {sortField === "customer" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />) : <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" onClick={() => handleSort("total_amount")} className="flex items-center hover:text-foreground transition-colors">
                        Amount
                        {sortField === "total_amount" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />) : <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" onClick={() => handleSort("status")} className="flex items-center hover:text-foreground transition-colors">
                        Status
                        {sortField === "status" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />) : <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" onClick={() => handleSort("issue_date")} className="flex items-center hover:text-foreground transition-colors">
                        Issue Date
                        {sortField === "issue_date" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />) : <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />}
                      </button>
                    </TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={isSelectionMode ? 8 : 7} className="text-center py-8 text-muted-foreground text-sm">
                        Loading quotations…
                      </TableCell>
                    </TableRow>
                  ) : displayedQuotations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSelectionMode ? 8 : 7}>
                        {searchTerm || statusFilter !== "all" ? (
                          <div className="flex flex-col items-center gap-3 py-14 text-center">
                            <div className="rounded-full bg-muted p-4">
                              <Search className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">No results found</p>
                              <p className="text-xs text-muted-foreground mt-0.5">No quotations match your current filters.</p>
                            </div>
                            <button type="button" onClick={() => setStatusFilter("all")} className="text-xs text-primary underline underline-offset-2">Clear filters</button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <div className="rounded-full bg-muted p-4">
                              <Plus className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">No quotations yet</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Create your first quotation to get started</p>
                            </div>
                            <Button asChild size="sm">
                              <Link to="/quotations/new"><Plus className="h-3.5 w-3.5 mr-1.5" />New Quotation</Link>
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedQuotations.map((q) => (
                      <TableRow key={q.id} className="group hover:bg-muted/50">
                        {isSelectionMode && (
                          <TableCell className="pl-4 w-10">
                            <Checkbox checked={selectedIds.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} aria-label={`Select ${q.quotation_number}`} className="translate-y-px" />
                          </TableCell>
                        )}
                        <TableCell className="font-medium pl-4">
                          <button
                            type="button"
                            className="text-left hover:text-primary hover:underline transition-colors"
                            onClick={() => setDrawerQuotation(q)}
                          >
                            {q.quotation_number}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{q.customers?.name || "Unknown Customer"}</TableCell>
                        <TableCell className="tabular-nums font-medium">{formatCurrency(q.total_amount || q.amount || 0)}</TableCell>
                        <TableCell>
                          <Badge className={`${getStatusBadge(q.status)} pointer-events-none`}>
                            {q.status === "converted"
                              ? "Converted to Invoice"
                              : q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(q.issue_date || q.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-muted-foreground">{q.valid_until ? format(new Date(q.valid_until), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {q.status !== "converted" && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  title="Download PDF"
                                  onClick={() => handleDownloadPdf(q)}
                                  disabled={isGeneratingPdf}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  title="Send Email"
                                  onClick={() => handleSendEmail(q)}
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  title="Send WhatsApp"
                                  onClick={() => handleSendWhatsApp(q)}
                                  disabled={!!whatsappLoading}
                                >
                                  {whatsappLoading === q.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <MessageCircle className="h-3.5 w-3.5 text-green-600" />}
                                </Button>
                                <Button size="sm" className="h-7 text-xs" onClick={() => openConvertDialog(q)}>
                                  <ArrowRight className="h-3.5 w-3.5 mr-1" />
                                  Convert
                                </Button>
                              </div>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDrawerQuotation(q)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                {q.status !== "converted" && (
                                  <DropdownMenuItem asChild>
                                    <Link to={`/quotations/${q.id}/edit`}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                {q.status !== "converted" && (
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(q.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Convert Dialog */}
          <Dialog
            open={convertDialogOpen}
            onOpenChange={(open) => {
              setConvertDialogOpen(open);
              if (!open) setSelectedQuotation(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convert quotation to invoice</DialogTitle>
                <DialogDescription>
                  {selectedQuotation
                    ? `You are converting ${selectedQuotation.quotation_number}. Choose the invoice date.`
                    : "Choose the invoice date."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <RadioGroup
                  value={dateOption}
                  onValueChange={(val) => setDateOption(val as "quotation" | "today" | "custom")}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="quotation" id="date-quotation" />
                    <Label htmlFor="date-quotation" className="cursor-pointer">
                      Use quotation issue date (
                      {selectedQuotation
                        ? format(new Date(selectedQuotation.issue_date || selectedQuotation.created_at), "PPP")
                        : "-"}
                      )
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="today" id="date-today" />
                    <Label htmlFor="date-today" className="cursor-pointer">
                      Use today's date ({format(new Date(), "PPP")})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="date-custom" />
                    <Label htmlFor="date-custom" className="cursor-pointer">
                      Pick a custom date
                    </Label>
                    {dateOption === "custom" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="ml-2">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDate ? format(customDate, "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDate}
                            onSelect={setCustomDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </RadioGroup>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setConvertDialogOpen(false)}
                  disabled={isConverting || isConvertingAndSending}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleConvertAndSendFromDialog}
                  disabled={isConverting || isConvertingAndSending}
                >
                  {isConvertingAndSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Converting &amp; Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Convert &amp; Send
                    </>
                  )}
                </Button>
                <Button onClick={confirmConvert} disabled={isConverting || isConvertingAndSending}>
                  {isConverting ? "Converting..." : "Convert"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bulk Delete Confirm */}
          <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
            <DialogContent className="sm:max-w-[360px]">
              <DialogHeader>
                <DialogTitle>Delete Drafts</DialogTitle>
                <DialogDescription>
                  Permanently delete all selected draft quotations? Only drafts will be removed. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={handleBulkDeleteQuotations} disabled={bulkLoading}>
                  {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>

      {/* Transaction Drawer */}
      <TransactionDrawer
        open={!!drawerQuotation}
        onOpenChange={(open) => !open && setDrawerQuotation(null)}
        transaction={
          drawerQuotation
            ? {
                id: drawerQuotation.id,
                quotation_number: drawerQuotation.quotation_number,
                issue_date: drawerQuotation.issue_date,
                valid_until: drawerQuotation.valid_until,
                amount: drawerQuotation.amount,
                vat_amount: drawerQuotation.vat_amount,
                total_amount: drawerQuotation.total_amount,
                status: drawerQuotation.status,
                customer_id: drawerQuotation.customer_id,
              }
            : null
        }
        type="quotation"
        onConvertQuotation={(id) => {
          const q = quotations.find((qt) => qt.id === id);
          if (q) openConvertDialog(q);
        }}
        onSendEmail={() => {
          if (drawerQuotation) {
            const q = drawerQuotation;
            setDrawerQuotation(null);
            handleSendEmail(q);
          }
        }}
        onSendWhatsApp={() => {
          if (drawerQuotation) {
            const q = drawerQuotation;
            setDrawerQuotation(null);
            handleSendWhatsApp(q);
          }
        }}
      />

      {/* Hidden PDF preview for quotation download/email */}
      {pdfQuotationData && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <UnifiedInvoiceLayout
            id="invoice-preview-root"
            variant="pdf"
            invoiceData={pdfQuotationData}
            documentType="QUOTATION"
            companySettings={buildCompanySettings()}
            bankingSettings={buildBankingSettings()}
            templateSettings={buildTemplateSettings()}
            quotationTerms={invoiceSettings?.quotation_terms_text || undefined}
          />
        </div>
      )}

      {/* Hidden PDF container for Convert & Send */}
      {pdfInvoiceData && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <UnifiedInvoiceLayout
            id="invoice-send-root"
            variant="pdf"
            invoiceData={pdfInvoiceData}
            documentType="INVOICE"
            companySettings={buildCompanySettings()}
            bankingSettings={buildBankingSettings()}
            templateSettings={buildTemplateSettings()}
          />
        </div>
      )}

      {/* Send Email Dialog */}
      {emailQuotation && user && companySettings && (
        <SendDocumentEmailDialog
          open={showEmailDialog}
          onOpenChange={(open) => {
            setShowEmailDialog(open);
            if (!open) {
              setEmailQuotation(null);
              setPdfQuotationData(null);
            }
          }}
          documentType="quotation"
          documentId={emailQuotation.id}
          documentNumber={emailQuotation.quotation_number}
          customer={{
            id: emailQuotation.customer_id,
            name: emailQuotation.customers?.name || "Customer",
            email: emailQuotation.customers?.email || null,
          }}
          companyName={companySettings.company_name || "Company"}
          userId={user.id}
          fontFamily={template?.font_family}
          onSuccess={async () => {
            if (emailQuotation.status === "draft") {
              await supabase.from("quotations").update({ status: "sent" }).eq("id", emailQuotation.id);
              setQuotations((prev) => prev.map((q) => (q.id === emailQuotation.id ? { ...q, status: "sent" } : q)));
              setFiltered((prev) => prev.map((q) => (q.id === emailQuotation.id ? { ...q, status: "sent" } : q)));
            }
          }}
        />
      )}
    </div>
  );
};

export default Quotations;
