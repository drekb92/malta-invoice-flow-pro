import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft,
  Download,
  Mail,
  MessageCircle,
  CheckCircle,
  AlertTriangle,
  FileText,
  Shield,
  Plus,
  CreditCard,
  Clock,
  MoreHorizontal,
  Lock,
  Copy,
  ExternalLink,
  Wallet,
  CalendarDays,
  User,
  Hash,
  Link2,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays } from "date-fns";
import { formatNumber } from "@/lib/utils";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { downloadPdfFromFunction, buildA4HtmlDocument } from "@/lib/edgePdf";
import { InvoiceErrorBoundary } from "@/components/InvoiceErrorBoundary";
import { invoiceService } from "@/services/invoiceService";
import { CreateCreditNoteDrawer } from "@/components/CreateCreditNoteDrawer";
import { SendDocumentEmailDialog } from "@/components/SendDocumentEmailDialog";
import { useDocumentSendLogs } from "@/hooks/useDocumentSendLogs";
import { useReminderStatus } from "@/hooks/useReminderStatus";
import { ReminderPromptBanner } from "@/components/ReminderPromptBanner";
import { ReminderHistoryPanel } from "@/components/ReminderHistoryPanel";

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
  discount_type?: "amount" | "percent";
  discount_value?: number;
  discount_reason?: string;
  is_issued?: boolean;
  issued_at?: string;
  invoice_hash?: string;
  customers?: {
    name: string;
    email?: string | null;
    address?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    locality?: string | null;
    post_code?: string | null;
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

interface Payment {
  id: string;
  invoice_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  method: string | null;
  created_at: string;
}

interface CreditNoteSummary {
  id: string;
  credit_note_number: string;
  amount: number;
  vat_rate: number | null;
  reason: string;
}

const InvoiceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceTotals, setInvoiceTotals] = useState<InvoiceTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [isIssuing, setIsIssuing] = useState(false);
  const [showCreditNoteDialog, setShowCreditNoteDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    method: "bank_transfer",
  });

  const [creditNotes, setCreditNotes] = useState<CreditNoteSummary[]>([]);

  const { toast } = useToast();
  const { template, isLoading: templateLoading } = useInvoiceTemplate();
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();
  
  // Fetch send logs for Activity section
  const { lastEmailSent, lastWhatsAppSent, refetch: refetchSendLogs } = useDocumentSendLogs(
    'invoice',
    id || ''
  );

  const fetchPayments = async () => {
    if (!id || !user) return;
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", id)
      .eq("user_id", user.id)
      .order("payment_date", { ascending: false });
    if (!error && data) {
      setPayments(data as Payment[]);
    }
  };

  const fetchCreditNotes = async () => {
    if (!id || !user) return;
    const { data, error } = await supabase
      .from("credit_notes")
      .select("id, credit_note_number, amount, vat_rate, reason")
      .eq("invoice_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setCreditNotes(data as CreditNoteSummary[]);
    }
  };

  useEffect(() => {
    if (!id || !user) return;

    const fetchInvoiceDetails = async () => {
      try {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from("invoices")
          .select(`*, customers (name, email, address, address_line1, address_line2, locality, post_code, vat_number, phone)`)
          .eq("id", id)
          .eq("user_id", user.id)
          .single();

        if (invoiceError) throw invoiceError;

        const { data: itemsData, error: itemsError } = await (supabase as any)
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", id);

        if (itemsError) throw itemsError;

        const { data: totalsData, error: totalsError } = await (supabase as any)
          .from("invoice_totals")
          .select("net_amount, vat_amount, total_amount")
          .eq("invoice_id", id)
          .maybeSingle();

        if (totalsError) throw totalsError;

        setInvoice({
          ...invoiceData,
          discount_type: invoiceData.discount_type as "amount" | "percent" | undefined,
        });
        setInvoiceItems(itemsData || []);
        setInvoiceTotals(totalsData);

        if ((invoiceData as any).is_issued) {
          const auditResult = await invoiceService.getInvoiceAuditTrail(id);
          if (auditResult.success && auditResult.auditTrail) {
            setAuditTrail(auditResult.auditTrail);
          }
        }
      } catch (error) {
        console.error("Error loading invoice details:", error);
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
    fetchPayments();
    fetchCreditNotes();
  }, [id, user, toast]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      partially_paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };
    return variants[status] || variants.draft;
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

  const subtotal = useMemo(() => {
    return invoiceItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  }, [invoiceItems]);

  const discountInfo = useMemo(() => {
    if (!invoice) return { amount: 0, isPercent: false, percentValue: 0 };
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const type = (invoice.discount_type as "amount" | "percent") || "amount";
    const raw = Number(invoice.discount_value || 0);
    if (type === "percent") {
      const pct = Math.min(Math.max(raw, 0), 100);
      return { amount: round2(subtotal * (pct / 100)), isPercent: true, percentValue: pct };
    } else {
      const amt = Math.min(Math.max(raw, 0), subtotal);
      return { amount: round2(amt), isPercent: false, percentValue: 0 };
    }
  }, [invoice, subtotal]);

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  const totalCreditNotesAmount = useMemo(() => {
    return creditNotes.reduce((sum, cn) => {
      const netAmount = Number(cn.amount || 0);
      const vatRate = Number(cn.vat_rate || 0);
      return sum + netAmount + (netAmount * vatRate);
    }, 0);
  }, [creditNotes]);

  const remainingBalance = useMemo(() => {
    const invoiceTotal = invoiceTotals?.total_amount ?? computedTotals.total;
    const adjustedTotal = Number(invoiceTotal) - totalCreditNotesAmount;
    return adjustedTotal - totalPaid;
  }, [invoiceTotals, computedTotals, totalPaid, totalCreditNotesAmount]);

  const dueIndicator = useMemo(() => {
    if (!invoice) return null;
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const diff = differenceInDays(dueDate, today);
    
    if (remainingBalance <= 0) return null;
    
    if (diff < 0) {
      return { text: `Overdue by ${Math.abs(diff)} days`, isOverdue: true };
    } else if (diff === 0) {
      return { text: "Due today", isOverdue: false };
    } else {
      return { text: `Due in ${diff} days`, isOverdue: false };
    }
  }, [invoice, remainingBalance]);

  // Reminder status for smart prompts (must be after remainingBalance is defined)
  const reminderStatus = useReminderStatus({
    invoiceId: id || '',
    dueDate: invoice?.due_date || '',
    status: invoice?.status || '',
    remainingBalance,
  });

  const handleDownload = async () => {
    if (!invoice) return;

    if (!companySettings?.company_name) {
      toast({
        title: "Company Settings Required",
        description: "Please complete your company information in Settings.",
        variant: "destructive",
      });
      return;
    }

    if (!template) {
      toast({
        title: "Template not ready",
        description: "Please wait for template to load and try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const filename = `Invoice-${invoice.invoice_number}`;
      await downloadPdfFromFunction(filename, template.font_family);
      toast({
        title: "PDF downloaded",
        description: `Invoice ${invoice.invoice_number} saved.`,
      });
    } catch (e) {
      console.error("[InvoiceDetails] PDF generation error:", e);
      toast({
        title: "PDF error",
        description: "Failed to generate invoice PDF.",
        variant: "destructive",
      });
    }
  };

  const handleEmailReminder = () => {
    if (!invoice) return;
    setShowEmailDialog(true);
  };

  const handleWhatsAppReminder = async () => {
    if (!invoice || !user) return;
    
    const phoneRaw = invoice.customers?.phone || "";
    const phone = phoneRaw.replace(/\D/g, "");

    // Generate share link with PDF
    setWhatsappLoading(true);
    try {
      const root = document.getElementById("invoice-preview-root") as HTMLElement | null;
      if (!root) {
        throw new Error("Document preview not found");
      }

      const html = buildA4HtmlDocument({
        filename: `Invoice-${invoice.invoice_number}`,
        fontFamily: template?.font_family || "Inter",
        clonedRoot: root.cloneNode(true) as HTMLElement,
      });

      const { data, error } = await supabase.functions.invoke("create-document-share-link", {
        body: {
          html,
          filename: `Invoice-${invoice.invoice_number}`,
          userId: user.id,
          documentType: "invoice",
          documentId: invoice.id,
          documentNumber: invoice.invoice_number,
          customerId: invoice.customer_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const shareUrl = data.url;
      const message = `Payment Reminder: Invoice ${invoice.invoice_number} of €${formatNumber(computedTotals.total, 2)} is due on ${format(new Date(invoice.due_date), "dd/MM/yyyy")}.\n\nView/Download PDF: ${shareUrl}`;

      const whatsappUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      
      // Open via redirect page to avoid cross-origin blocking
      const waWindow = window.open(`/redirect?url=${encodeURIComponent(whatsappUrl)}`, "_blank");
      if (!waWindow) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site and try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "WhatsApp opened",
        description: "Share link created and WhatsApp opened.",
      });
    } catch (error: any) {
      console.error("[InvoiceDetails] WhatsApp share error:", error);
      toast({
        title: "Failed to create share link",
        description: error.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleIssueInvoice = async () => {
    if (!id || !invoice) return;
    setIsIssuing(true);
    const result = await invoiceService.issueInvoice(id);
    setIsIssuing(false);

    if (result.success) {
      const { data: updatedInvoice } = await supabase.from("invoices").select("*").eq("id", id).single();
      if (updatedInvoice) {
        setInvoice({ ...invoice, ...(updatedInvoice as any) });
      }
      const auditResult = await invoiceService.getInvoiceAuditTrail(id);
      if (auditResult.success && auditResult.auditTrail) {
        setAuditTrail(auditResult.auditTrail);
      }
    }
  };

  const handleCreateCreditNote = () => {
    setShowCreditNoteDialog(true);
  };

  const handleCreditNoteSuccess = async () => {
    if (!id) return;
    const { data: updatedInvoice } = await supabase.from("invoices").select("*").eq("id", id).single();
    if (updatedInvoice && invoice) {
      setInvoice({ ...invoice, ...(updatedInvoice as any) });
    }
    fetchCreditNotes();
    const auditResult = await invoiceService.getInvoiceAuditTrail(id);
    if (auditResult.success && auditResult.auditTrail) {
      setAuditTrail(auditResult.auditTrail);
    }
  };

  const handleAddPayment = async () => {
    if (!id || !user || !invoice) return;

    const amount = parseFloat(newPayment.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    if (amount > remainingBalance + 0.01) {
      toast({
        title: "Amount exceeds balance",
        description: `Payment cannot exceed remaining balance of €${formatNumber(remainingBalance, 2)}.`,
        variant: "destructive",
      });
      return;
    }

    setPaymentLoading(true);
    try {
      const { error } = await supabase.from("payments").insert({
        user_id: user.id,
        invoice_id: id,
        amount: amount,
        payment_date: newPayment.payment_date,
        method: newPayment.method,
      });

      if (error) throw error;

      await fetchPayments();

      const newTotalPaid = totalPaid + amount;
      const invoiceTotal = Number(invoiceTotals?.total_amount ?? computedTotals.total);
      const adjustedTotal = invoiceTotal - totalCreditNotesAmount;
      const newRemainingBalance = adjustedTotal - newTotalPaid;

      if (newRemainingBalance <= 0.01) {
        await supabase.from("invoices").update({ status: "paid" }).eq("id", id).eq("user_id", user.id);
        setInvoice({ ...invoice, status: "paid" });
      } else if (newTotalPaid > 0 && newRemainingBalance > 0.01) {
        await supabase.from("invoices").update({ status: "partially_paid" }).eq("id", id).eq("user_id", user.id);
        setInvoice({ ...invoice, status: "partially_paid" });
      }

      toast({
        title: "Payment recorded",
        description: `Payment of €${formatNumber(amount, 2)} has been added.`,
      });

      setNewPayment({
        amount: "",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        method: "bank_transfer",
      });
      setShowPaymentDialog(false);
    } catch (error) {
      console.error("Error adding payment:", error);
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  const getMethodLabel = (method: string | null) => {
    const methods: Record<string, string> = {
      bank_transfer: "Bank Transfer",
      cash: "Cash",
      card: "Card",
      check: "Check",
      other: "Other",
    };
    return methods[method || ""] || method || "—";
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const isSettled = remainingBalance <= 0;
  const isIssued = (invoice as any)?.is_issued;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="md:ml-64">
          <div className="p-6">
            <div className="text-center py-12">Loading invoice details...</div>
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
                  <ChevronLeft className="h-4 w-4 mr-2" />
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
        {/* Header */}
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Breadcrumb and Title */}
              <div className="flex items-center gap-3">
                <Link to="/invoices" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-sm">Invoices</span>
                </Link>
                <span className="text-muted-foreground">/</span>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold text-foreground">{invoice.invoice_number}</h1>
                  {isIssued ? (
                    <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 gap-1">
                      <Lock className="h-3 w-3" />
                      Issued
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400 gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Draft
                    </Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {!isIssued && (
                  <Button onClick={handleIssueInvoice} disabled={isIssuing} size="sm" className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {isIssuing ? "Issuing..." : "Issue"}
                  </Button>
                )}
                <Button onClick={handleDownload} size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download PDF
                </Button>
                {remainingBalance > 0 && (
                  <Button onClick={() => setShowPaymentDialog(true)} variant="secondary" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Payment
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    {isIssued && (
                      <DropdownMenuItem onClick={handleCreateCreditNote}>
                        <FileText className="h-4 w-4 mr-2" />
                        Create Credit Note
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleEmailReminder}>
                      <Mail className="h-4 w-4 mr-2" />
                      Email Reminder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleWhatsAppReminder}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <main className="px-6 py-2 space-y-2">
          {/* Invoice Summary Strip */}
          <Card className="shadow-none bg-muted/20 border-border/40">
            <CardContent className="px-3 py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <Link
                    to={`/customers/${invoice.customer_id}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {invoice.customers?.name || "Unknown Customer"}
                  </Link>
                  <span className="text-muted-foreground/60 hidden sm:inline">•</span>
                  <span className="text-muted-foreground">
                    Issued {format(new Date((invoice as any).invoice_date || invoice.created_at), "dd MMM yyyy")}
                  </span>
                  <span className="text-muted-foreground/60 hidden sm:inline">•</span>
                  <span className="text-muted-foreground">
                    Due {format(new Date(invoice.due_date), "dd MMM yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Status: <span className="font-medium text-foreground">{invoice.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                  </span>
                  {dueIndicator && !isSettled && (
                    <>
                      <span className="text-muted-foreground/60">•</span>
                      <span className={dueIndicator.isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}>
                        {dueIndicator.text}
                      </span>
                    </>
                  )}
                  {/* Inline compliance tag */}
                  {isIssued && (
                    <>
                      <span className="text-muted-foreground/60 hidden sm:inline">•</span>
                      <span className="hidden sm:inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                        <Shield className="h-2.5 w-2.5" />
                        <span className="font-medium">Compliant</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Note - mobile only or draft */}
          {!isIssued && (
            <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded px-2.5 py-1 max-w-fit">
              <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                <span className="font-medium">Draft</span> — Editable until issued
              </p>
            </div>
          )}

          {/* Smart Reminder Prompt Banner */}
          {isIssued && invoice && reminderStatus.shouldShowReminder && (
            <ReminderPromptBanner
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              reminderStatus={reminderStatus}
            />
          )}

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Main Content */}
            <div className="flex-1 space-y-2 min-w-0">
              {/* Mobile Sidebar - shown above content on mobile */}
              <div className="lg:hidden">
                <SidebarCard
                  invoice={invoice}
                  remainingBalance={remainingBalance}
                  isSettled={isSettled}
                  totalPaid={totalPaid}
                  computedTotals={computedTotals}
                  invoiceTotals={invoiceTotals}
                  creditNotes={creditNotes}
                  discountInfo={discountInfo}
                  subtotal={subtotal}
                  dueIndicator={dueIndicator}
                  getStatusBadge={getStatusBadge}
                  copyToClipboard={copyToClipboard}
                  onEmailReminder={handleEmailReminder}
                  onWhatsAppReminder={handleWhatsAppReminder}
                  onCreateCreditNote={handleCreateCreditNote}
                  whatsappLoading={whatsappLoading}
                  lastEmailSent={lastEmailSent}
                  lastWhatsAppSent={lastWhatsAppSent}
                />
              </div>

              {/* Line Items */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Line Items</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="py-2 text-xs font-medium">Description</TableHead>
                          <TableHead className="py-2 text-xs font-medium text-right w-14">Qty</TableHead>
                          <TableHead className="py-2 text-xs font-medium text-right w-20">Price</TableHead>
                          <TableHead className="py-2 text-xs font-medium text-right w-14">VAT</TableHead>
                          <TableHead className="py-2 text-xs font-medium text-right w-24">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                              No line items found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          invoiceItems.map((item) => {
                            const lineTotal = item.quantity * item.unit_price;
                            return (
                              <TableRow key={item.id} className="border-b border-border/50 last:border-0">
                                <TableCell className="py-2">
                                  <span className="line-clamp-2 text-sm">{item.description}</span>
                                </TableCell>
                                <TableCell className="py-2 text-sm text-right tabular-nums">{item.quantity}</TableCell>
                                <TableCell className="py-2 text-sm text-right tabular-nums">€{formatNumber(item.unit_price, 2)}</TableCell>
                                <TableCell className="py-2 text-sm text-right tabular-nums text-muted-foreground">{formatNumber(item.vat_rate * 100, 0)}%</TableCell>
                                <TableCell className="py-2 text-sm text-right font-medium tabular-nums">€{formatNumber(lineTotal, 2)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                    {/* Table Footer Totals */}
                    {invoiceItems.length > 0 && (
                      <div className="border-t-2 border-border bg-muted/20">
                        <div className="flex flex-col items-end py-2 pr-4">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 w-40">
                            <span className="text-muted-foreground text-xs">Net</span>
                            <span className="tabular-nums text-right text-xs">€{formatNumber(invoiceTotals?.net_amount ?? computedTotals.net, 2)}</span>
                            {discountInfo.amount > 0 && (
                              <>
                                <span className="text-muted-foreground text-xs">Discount</span>
                                <span className="tabular-nums text-right text-muted-foreground text-xs">(€{formatNumber(discountInfo.amount, 2)})</span>
                              </>
                            )}
                            <span className="text-muted-foreground text-xs">VAT</span>
                            <span className="tabular-nums text-right text-xs">€{formatNumber(invoiceTotals?.vat_amount ?? computedTotals.vat, 2)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-8 w-40 mt-1.5 pt-1.5 border-t border-border">
                            <span className="font-semibold text-sm">Total</span>
                            <span className="tabular-nums text-right font-bold text-sm">€{formatNumber(invoiceTotals?.total_amount ?? computedTotals.total, 2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card className="shadow-sm">
                <CardHeader className="py-2.5 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment History
                    </CardTitle>
                    {payments.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Paid: <span className="font-medium text-foreground">€{formatNumber(totalPaid, 2)}</span>
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-2">
                  {payments.length === 0 ? (
                    <div className="flex items-center gap-3 py-2 px-3 border rounded-md bg-muted/20">
                      <Wallet className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">No payments yet</p>
                        <p className="text-xs text-muted-foreground">Record a payment to update the balance.</p>
                      </div>
                      {remainingBalance > 0 && (
                        <Button onClick={() => setShowPaymentDialog(true)} size="sm" variant="outline" className="h-7 text-xs flex-shrink-0">
                          <Plus className="h-3 w-3 mr-1" />
                          Add Payment
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="py-2 text-xs font-medium">Date</TableHead>
                            <TableHead className="py-2 text-xs font-medium">Method</TableHead>
                            <TableHead className="py-2 text-xs font-medium text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id} className="border-b border-border/50 last:border-0">
                              <TableCell className="py-2 text-sm">{format(new Date(payment.payment_date), "dd MMM yyyy")}</TableCell>
                              <TableCell className="py-2 text-sm text-muted-foreground">{getMethodLabel(payment.method)}</TableCell>
                              <TableCell className="py-2 text-sm text-right font-medium tabular-nums">€{formatNumber(payment.amount, 2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reminder History */}
              <ReminderHistoryPanel invoiceId={id || ''} />

              {/* Audit Trail */}
              {isIssued && auditTrail.length > 0 && (
                <div className="border border-border/60 rounded-lg bg-card/50 shadow-sm">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="audit-trail" className="border-0">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:ring-offset-0 rounded-lg [&[data-state=open]>div>.audit-helper]:hidden">
                        <div className="flex items-center justify-between w-full pr-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Shield className="h-3.5 w-3.5" />
                            Audit Trail
                          </div>
                          <span className="audit-helper text-xs text-muted-foreground">
                            Latest: {auditTrail[0]?.action === "issued" ? "Invoice Issued" : auditTrail[0]?.action === "credit_note_created" ? "Credit Note Created" : auditTrail[0]?.action} · Malta VAT compliant
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-3">
                        <div className="relative ml-2">
                          <div className="absolute left-0 top-1 bottom-1 w-px bg-border" />
                          <div className="space-y-1.5">
                            {auditTrail.map((entry, index) => (
                              <div key={entry.id || index} className="relative pl-4 py-0.5">
                                <div className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-primary -translate-x-[2.5px]" />
                                <div className="flex items-baseline gap-2">
                                  <p className="font-medium text-xs">
                                    {entry.action === "issued" && "Invoice Issued"}
                                    {entry.action === "credit_note_created" && "Credit Note Created"}
                                    {entry.action === "created" && "Invoice Created"}
                                    {entry.action === "correction_note_added" && "Correction Note Added"}
                                  </p>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(entry.timestamp), "dd MMM yyyy, HH:mm")}
                                  </span>
                                </div>
                                {entry.new_data && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {entry.action === "issued" && `Invoice #${entry.new_data.invoice_number} locked`}
                                    {entry.action === "credit_note_created" && `${entry.new_data.credit_note_number} for €${formatNumber(entry.new_data.amount, 2)}`}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                          Maintained for Malta VAT compliance.
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden lg:block w-72 flex-shrink-0">
              <div className="sticky top-4">
                <SidebarCard
                  invoice={invoice}
                  remainingBalance={remainingBalance}
                  isSettled={isSettled}
                  totalPaid={totalPaid}
                  computedTotals={computedTotals}
                  invoiceTotals={invoiceTotals}
                  creditNotes={creditNotes}
                  discountInfo={discountInfo}
                  subtotal={subtotal}
                  dueIndicator={dueIndicator}
                  getStatusBadge={getStatusBadge}
                  copyToClipboard={copyToClipboard}
                  onEmailReminder={handleEmailReminder}
                  onWhatsAppReminder={handleWhatsAppReminder}
                  onCreateCreditNote={handleCreateCreditNote}
                  whatsappLoading={whatsappLoading}
                  lastEmailSent={lastEmailSent}
                  lastWhatsAppSent={lastWhatsAppSent}
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Hidden elements for PDF generation */}
      <div style={{ display: "none" }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(template?.font_family || "Inter")}:wght@400;600;700&display=swap`}
          rel="stylesheet"
        />
      </div>

      {/* PDF styles are embedded in UnifiedInvoiceLayout */}

      <div style={{ display: "none" }}>
        {invoice && template && !templateLoading && (
          <InvoiceErrorBoundary>
            <UnifiedInvoiceLayout
              id="invoice-preview-root"
              variant="pdf"
              debug={false}
              invoiceData={{
                invoiceNumber: invoice.invoice_number,
                invoiceDate: format(new Date((invoice as any).invoice_date || invoice.created_at), "yyyy-MM-dd"),
                dueDate: invoice.due_date,
                customer: {
                  name: invoice.customers?.name || "Unknown Customer",
                  email: invoice.customers?.email || undefined,
                  address: invoice.customers?.address || undefined,
                  address_line1: invoice.customers?.address_line1 || undefined,
                  address_line2: invoice.customers?.address_line2 || undefined,
                  locality: invoice.customers?.locality || undefined,
                  post_code: invoice.customers?.post_code || undefined,
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
                discount:
                  discountInfo.amount > 0
                    ? {
                        type: (invoice.discount_type as "amount" | "percent") || "amount",
                        value: Number(invoice.discount_value || 0),
                        amount: discountInfo.amount,
                      }
                    : undefined,
              }}
              templateSettings={{
                primaryColor: template.primary_color,
                accentColor: template.accent_color,
                fontFamily: template.font_family,
                fontSize: template.font_size,
                layout: template?.layout || "default",
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
            />
          </InvoiceErrorBoundary>
        )}
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice {invoice?.invoice_number}. Remaining balance: €{formatNumber(remainingBalance, 2)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="payment_amount">Amount (€)</Label>
              <Input
                id="payment_amount"
                type="number"
                step="0.01"
                min="0"
                max={remainingBalance}
                placeholder={`Max: €${formatNumber(remainingBalance, 2)}`}
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={newPayment.payment_date}
                onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select value={newPayment.method} onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}>
                <SelectTrigger id="payment_method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPayment} disabled={paymentLoading}>
              {paymentLoading ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Note Drawer */}
      {invoice && (
        <CreateCreditNoteDrawer
          open={showCreditNoteDialog}
          onOpenChange={setShowCreditNoteDialog}
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          customerId={invoice.customer_id}
          onSuccess={handleCreditNoteSuccess}
        />
      )}

      {/* Send Email Dialog */}
      {invoice && user && companySettings && (() => {
        const isFirstSend = !lastEmailSent?.sentAt;
        const formattedDueDate = format(new Date(invoice.due_date), "dd MMM yyyy");
        const formattedAmount = `€${formatNumber(remainingBalance, 2)}`;
        const companyNameStr = companySettings.company_name || "Company";
        const customerName = invoice.customers?.name || "Customer";

        // First-time send copy
        const firstSendSubject = `Invoice ${invoice.invoice_number} from ${companyNameStr}`;
        const firstSendMessage = `Dear ${customerName},

Please find attached invoice ${invoice.invoice_number} for ${formattedAmount}, due on ${formattedDueDate}.

If you have any questions, please don't hesitate to contact us.

Best regards,
${companyNameStr}`;

        // Reminder copy
        const reminderSubject = `Payment Reminder: Invoice ${invoice.invoice_number} from ${companyNameStr}`;
        const reminderMessage = `Dear ${customerName},

This is a friendly reminder that invoice ${invoice.invoice_number} for ${formattedAmount} was due on ${formattedDueDate}.

Please arrange payment at your earliest convenience. If you have already made this payment, please disregard this message.

If you have any questions, please don't hesitate to contact us.

Best regards,
${companyNameStr}`;

        return (
          <SendDocumentEmailDialog
            open={showEmailDialog}
            onOpenChange={setShowEmailDialog}
            documentType="invoice"
            documentId={invoice.id}
            documentNumber={invoice.invoice_number}
            customer={{
              id: invoice.customer_id,
              name: customerName,
              email: invoice.customers?.email || null,
            }}
            companyName={companyNameStr}
            userId={user.id}
            fontFamily={template?.font_family}
            onSuccess={refetchSendLogs}
            defaultSubjectOverride={isFirstSend ? firstSendSubject : reminderSubject}
            defaultMessageOverride={isFirstSend ? firstSendMessage : reminderMessage}
          />
        );
      })()}
    </div>
  );
};

// Sidebar Card Component
interface SidebarCardProps {
  invoice: Invoice;
  remainingBalance: number;
  isSettled: boolean;
  totalPaid: number;
  computedTotals: { net: number; vat: number; total: number };
  invoiceTotals: InvoiceTotals | null;
  creditNotes: CreditNoteSummary[];
  discountInfo: { amount: number; isPercent: boolean; percentValue: number };
  subtotal: number;
  dueIndicator: { text: string; isOverdue: boolean } | null;
  getStatusBadge: (status: string) => string;
  copyToClipboard: (text: string, label: string) => void;
  onEmailReminder?: () => void;
  onWhatsAppReminder?: () => void;
  onCreateCreditNote?: () => void;
  whatsappLoading?: boolean;
  lastEmailSent?: { sentAt: string; recipient?: string } | null;
  lastWhatsAppSent?: { sentAt: string; shareUrl?: string } | null;
}

const SidebarCard = ({
  invoice,
  remainingBalance,
  isSettled,
  totalPaid,
  computedTotals,
  invoiceTotals,
  creditNotes,
  discountInfo,
  subtotal,
  dueIndicator,
  getStatusBadge,
  copyToClipboard,
  onEmailReminder,
  onWhatsAppReminder,
  onCreateCreditNote,
  whatsappLoading,
  lastEmailSent,
  lastWhatsAppSent,
}: SidebarCardProps) => {
  const total = invoiceTotals?.total_amount ?? computedTotals.total;
  const vat = invoiceTotals?.vat_amount ?? computedTotals.vat;
  
  const totalCreditNotesAmount = creditNotes.reduce((sum, cn) => {
    const netAmount = Number(cn.amount || 0);
    const vatRate = Number(cn.vat_rate || 0);
    return sum + netAmount + (netAmount * vatRate);
  }, 0);

  const isIssued = (invoice as any)?.is_issued;
  const invoiceUrl = typeof window !== 'undefined' ? `${window.location.origin}/invoices/${invoice.id}` : '';

  return (
    <Card className="shadow-sm">
      <CardContent className="p-2.5 space-y-2">
        {/* Status and Balance Due - same row */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs text-muted-foreground">Balance Due</span>
            <Badge className={`${getStatusBadge(invoice.status)} text-[10px] px-1.5 py-0 h-4`}>
              {invoice.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </Badge>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums">
              {isSettled ? "€0.00" : `€${formatNumber(Math.max(0, remainingBalance), 2)}`}
            </span>
            {isSettled && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle className="h-3 w-3" />
                Paid
              </span>
            )}
          </div>
          
          {dueIndicator && !isSettled && (
            <div className={`mt-0.5 text-xs font-medium ${dueIndicator.isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              <Clock className="h-3 w-3 inline mr-1" />
              {dueIndicator.text}
            </div>
          )}
        </div>

        {/* Totals Breakdown */}
        <div className="border-t pt-1.5 space-y-0.5 text-sm">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">€{formatNumber(subtotal, 2)}</span>
          </div>
          {discountInfo.amount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Discount</span>
              <span className="tabular-nums text-muted-foreground">(€{formatNumber(discountInfo.amount, 2)})</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">VAT</span>
            <span className="tabular-nums">€{formatNumber(vat, 2)}</span>
          </div>
          <div className="flex justify-between font-medium pt-1 border-t text-sm">
            <span>Total</span>
            <span className="tabular-nums font-bold">€{formatNumber(total, 2)}</span>
          </div>
          
          {creditNotes.length > 0 && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Credit Notes ({creditNotes.length})</span>
                <span className="tabular-nums text-muted-foreground">(€{formatNumber(totalCreditNotesAmount, 2)})</span>
              </div>
              <div className="flex justify-between font-medium text-sm">
                <span>Adjusted</span>
                <span className="tabular-nums">€{formatNumber(Math.max(0, total - totalCreditNotesAmount), 2)}</span>
              </div>
            </>
          )}
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paid</span>
            <span className="tabular-nums">€{formatNumber(totalPaid, 2)}</span>
          </div>
        </div>

        {/* Quick Actions - compact outline buttons with hover states */}
        {isIssued && (
          <div className="border-t pt-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Quick Actions
            </div>
            <div className="space-y-1">
              {!isSettled && onEmailReminder && (
                <Button
                  onClick={onEmailReminder}
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs justify-start gap-2 hover:bg-muted/50 transition-colors"
                >
                  <Mail className="h-3 w-3" />
                  {lastEmailSent?.sentAt ? "Send Email Reminder" : "Send Invoice Email"}
                </Button>
              )}
              {!isSettled && onWhatsAppReminder && (
                <Button
                  onClick={onWhatsAppReminder}
                  variant="outline"
                  size="sm"
                  disabled={whatsappLoading}
                  className="w-full h-7 text-xs justify-start gap-2 hover:bg-muted/50 transition-colors"
                >
                  {whatsappLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                  {whatsappLoading ? "Creating link..." : lastWhatsAppSent?.sentAt ? "Send WhatsApp Reminder" : "Send via WhatsApp"}
                </Button>
              )}
              {onCreateCreditNote && (
                <Button
                  onClick={onCreateCreditNote}
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs justify-start gap-2 hover:bg-muted/50 transition-colors"
                >
                  <FileText className="h-3 w-3" />
                  Create Credit Note
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Send Status Section */}
        {isIssued && (
          <div className="border-t pt-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              Send Status
            </div>
            <div className="space-y-1.5">
              {/* Email Status */}
              <div className="flex items-center gap-2 text-xs">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                  lastEmailSent?.sentAt 
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  <Mail className="h-3 w-3" />
                  {lastEmailSent?.sentAt ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Email sent
                    </span>
                  ) : (
                    <span>Email not sent</span>
                  )}
                </div>
                {lastEmailSent?.sentAt && (
                  <span className="text-muted-foreground tabular-nums text-[11px]">
                    {format(new Date(lastEmailSent.sentAt), "dd MMM, HH:mm")}
                  </span>
                )}
              </div>
              
              {/* WhatsApp Status */}
              <div className="flex items-center gap-2 text-xs">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                  lastWhatsAppSent?.sentAt 
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  <MessageCircle className="h-3 w-3" />
                  {lastWhatsAppSent?.sentAt ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      WhatsApp sent
                    </span>
                  ) : (
                    <span>WhatsApp not sent</span>
                  )}
                </div>
                {lastWhatsAppSent?.sentAt && (
                  <span className="text-muted-foreground tabular-nums text-[11px]">
                    {format(new Date(lastWhatsAppSent.sentAt), "dd MMM, HH:mm")}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Customer Section */}
        <div className="border-t pt-2">
          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            <User className="h-2.5 w-2.5" />
            Customer
          </div>
          <Link
            to={`/customers/${invoice.customer_id}`}
            className="text-sm font-medium text-foreground hover:text-primary flex items-center gap-1 group"
          >
            {invoice.customers?.name || "Unknown Customer"}
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          {invoice.customers?.email && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-muted-foreground truncate">{invoice.customers.email}</span>
              <button
                onClick={() => copyToClipboard(invoice.customers?.email || "", "Email")}
                className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="border-t pt-2 space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            <FileText className="h-2.5 w-2.5" />
            Invoice Details
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              Number
            </span>
            <div className="flex items-center gap-1">
              <span className="font-medium">{invoice.invoice_number}</span>
              <button
                onClick={() => copyToClipboard(invoice.invoice_number, "Invoice number")}
                className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Issued
            </span>
            <span>{format(new Date((invoice as any).invoice_date || invoice.created_at), "dd MMM yyyy")}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Due
            </span>
            <span className={dueIndicator?.isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
              {format(new Date(invoice.due_date), "dd MMM yyyy")}
            </span>
          </div>

          {/* Copy invoice link */}
          <button
            onClick={() => copyToClipboard(invoiceUrl, "Invoice link")}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-2 py-1 mt-1.5 transition-colors border border-border/50"
          >
            <Link2 className="h-3 w-3" />
            Copy Invoice Link
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceDetails;
