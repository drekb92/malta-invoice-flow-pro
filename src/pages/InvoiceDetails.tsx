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
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { InvoiceErrorBoundary } from "@/components/InvoiceErrorBoundary";
import { invoiceService } from "@/services/invoiceService";
import { CreateCreditNoteDrawer } from "@/components/CreateCreditNoteDrawer";

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
    const email = invoice.customers?.email || "";
    const subject = `Payment Reminder: Invoice ${invoice.invoice_number}`;
    const body = `Dear ${invoice.customers?.name || "Customer"},%0D%0A%0D%0AThis is a friendly reminder that invoice ${invoice.invoice_number} for €${formatNumber(computedTotals.total, 2)} is due on ${format(new Date(invoice.due_date), "dd/MM/yyyy")}.%0D%0A%0D%0AThank you.`;
    if (email) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${body}`;
    } else {
      toast({
        title: "No email available",
        description: "Customer email not found.",
        variant: "destructive",
      });
    }
  };

  const handleWhatsAppReminder = () => {
    if (!invoice) return;
    const message = `Payment Reminder: Invoice ${invoice.invoice_number} of €${formatNumber(computedTotals.total, 2)} is due on ${format(new Date(invoice.due_date), "dd/MM/yyyy")}.`;
    const phoneRaw = invoice.customers?.phone || "";
    const phone = phoneRaw.replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
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

        <main className="p-6">
          {/* Compliance Note */}
          {isIssued ? (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-md px-3 py-2 mb-6 max-w-fit">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-xs text-green-700 dark:text-green-400">
                <span className="font-medium">Compliant</span> — Issued {format(new Date((invoice as any).issued_at), "dd MMM yyyy")}. Use credit note for corrections.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 rounded-md px-3 py-2 mb-6 max-w-fit">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                <span className="font-medium">Draft</span> — Editable until issued. Becomes immutable per Malta VAT.
              </p>
            </div>
          )}

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-6 min-w-0">
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
                          <TableHead className="py-3 text-xs font-medium">Description</TableHead>
                          <TableHead className="py-3 text-xs font-medium text-right w-16">Qty</TableHead>
                          <TableHead className="py-3 text-xs font-medium text-right w-20">Price</TableHead>
                          <TableHead className="py-3 text-xs font-medium text-right w-16">VAT</TableHead>
                          <TableHead className="py-3 text-xs font-medium text-right w-24">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No line items found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          invoiceItems.map((item) => {
                            const lineTotal = item.quantity * item.unit_price;
                            return (
                              <TableRow key={item.id} className="border-b border-border/50 last:border-0">
                                <TableCell className="py-3">
                                  <span className="line-clamp-2 text-sm">{item.description}</span>
                                </TableCell>
                                <TableCell className="py-3 text-sm text-right tabular-nums">{item.quantity}</TableCell>
                                <TableCell className="py-3 text-sm text-right tabular-nums">€{formatNumber(item.unit_price, 2)}</TableCell>
                                <TableCell className="py-3 text-sm text-right tabular-nums text-muted-foreground">{formatNumber(item.vat_rate * 100, 0)}%</TableCell>
                                <TableCell className="py-3 text-sm text-right font-medium tabular-nums">€{formatNumber(lineTotal, 2)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                    {/* Table Footer Totals */}
                    {invoiceItems.length > 0 && (
                      <div className="bg-muted/30 border-t px-4 py-3">
                        <div className="flex flex-col gap-1 items-end text-sm">
                          <div className="flex justify-between w-48">
                            <span className="text-muted-foreground">Net:</span>
                            <span className="tabular-nums">€{formatNumber(invoiceTotals?.net_amount ?? computedTotals.net, 2)}</span>
                          </div>
                          {discountInfo.amount > 0 && (
                            <div className="flex justify-between w-48 text-destructive">
                              <span>Discount{discountInfo.isPercent ? ` (${discountInfo.percentValue}%)` : ''}:</span>
                              <span className="tabular-nums">−€{formatNumber(discountInfo.amount, 2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between w-48">
                            <span className="text-muted-foreground">VAT:</span>
                            <span className="tabular-nums">€{formatNumber(invoiceTotals?.vat_amount ?? computedTotals.vat, 2)}</span>
                          </div>
                          <div className="flex justify-between w-48 pt-2 border-t border-border font-semibold">
                            <span>Total:</span>
                            <span className="tabular-nums">€{formatNumber(invoiceTotals?.total_amount ?? computedTotals.total, 2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment History
                    </CardTitle>
                    {payments.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        Total paid: <span className="font-medium text-foreground">€{formatNumber(totalPaid, 2)}</span>
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {payments.length === 0 ? (
                    <div className="text-center py-8 border rounded-lg bg-muted/20">
                      <Wallet className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm font-medium text-foreground mb-1">No payments yet</p>
                      <p className="text-xs text-muted-foreground mb-4">Record the first payment to update the balance due.</p>
                      {remainingBalance > 0 && (
                        <Button onClick={() => setShowPaymentDialog(true)} size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Payment
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="py-2.5 text-xs font-medium">Date</TableHead>
                            <TableHead className="py-2.5 text-xs font-medium">Method</TableHead>
                            <TableHead className="py-2.5 text-xs font-medium text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id} className="border-b border-border/50 last:border-0">
                              <TableCell className="py-2.5 text-sm">{format(new Date(payment.payment_date), "dd MMM yyyy")}</TableCell>
                              <TableCell className="py-2.5 text-sm text-muted-foreground">{getMethodLabel(payment.method)}</TableCell>
                              <TableCell className="py-2.5 text-sm text-right font-medium tabular-nums">€{formatNumber(payment.amount, 2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Audit Trail */}
              {isIssued && auditTrail.length > 0 && (
                <Card className="shadow-sm">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="audit-trail" className="border-0">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center gap-2 text-base font-semibold">
                          <Shield className="h-4 w-4" />
                          Audit Trail
                          <span className="text-xs font-normal text-muted-foreground ml-2">
                            Latest: {auditTrail[0]?.action === "issued" ? "Invoice Issued" : auditTrail[0]?.action === "credit_note_created" ? "Credit Note Created" : auditTrail[0]?.action}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-4">
                        <div className="relative ml-2">
                          <div className="absolute left-0 top-1 bottom-1 w-px bg-border" />
                          <div className="space-y-2">
                            {auditTrail.map((entry, index) => (
                              <div key={entry.id || index} className="relative pl-4 py-1">
                                <div className="absolute left-0 top-2 w-2 h-2 rounded-full bg-primary -translate-x-[3.5px]" />
                                <div className="flex items-baseline gap-2">
                                  <p className="font-medium text-sm">
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
                        <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
                          Maintained for Malta VAT compliance.
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              )}
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden lg:block w-80 flex-shrink-0">
              <div className="sticky top-6">
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

      <style>{`
        @page { size: A4; margin: 0; }
        #invoice-preview-root{
          --font: '${template?.font_family || "Inter"}', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          --color-primary: ${template?.primary_color || "#111827"};
          --color-accent: ${template?.accent_color || "#2563EB"};
          --th-bg: ${(template as any)?.line_item_header_bg || "#F3F4F6"};
          --th-text: ${(template as any)?.line_item_header_text || "#111827"};
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
}: SidebarCardProps) => {
  const total = invoiceTotals?.total_amount ?? computedTotals.total;
  const net = invoiceTotals?.net_amount ?? computedTotals.net;
  const vat = invoiceTotals?.vat_amount ?? computedTotals.vat;
  
  const totalCreditNotesAmount = creditNotes.reduce((sum, cn) => {
    const netAmount = Number(cn.amount || 0);
    const vatRate = Number(cn.vat_rate || 0);
    return sum + netAmount + (netAmount * vatRate);
  }, 0);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-5 space-y-5">
        {/* Status and Balance Due */}
        <div>
          <Badge className={`${getStatusBadge(invoice.status)} text-xs px-2 py-0.5 mb-3`}>
            {invoice.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </Badge>
          
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">
              {isSettled ? "€0.00" : `€${formatNumber(Math.max(0, remainingBalance), 2)}`}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isSettled ? (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Paid in full
              </span>
            ) : (
              "Balance Due"
            )}
          </p>
          
          {dueIndicator && !isSettled && (
            <div className={`mt-2 text-xs font-medium ${dueIndicator.isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              <Clock className="h-3 w-3 inline mr-1" />
              {dueIndicator.text}
            </div>
          )}
        </div>

        {/* Totals Breakdown */}
        <div className="border-t pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">€{formatNumber(subtotal, 2)}</span>
          </div>
          {discountInfo.amount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Discount{discountInfo.isPercent ? ` (${discountInfo.percentValue}%)` : ''}</span>
              <span className="tabular-nums">−€{formatNumber(discountInfo.amount, 2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT</span>
            <span className="tabular-nums">€{formatNumber(vat, 2)}</span>
          </div>
          <div className="flex justify-between font-medium pt-2 border-t">
            <span>Total</span>
            <span className="tabular-nums">€{formatNumber(total, 2)}</span>
          </div>
          
          {creditNotes.length > 0 && (
            <>
              <div className="flex justify-between text-destructive">
                <span>Credit Notes ({creditNotes.length})</span>
                <span className="tabular-nums">−€{formatNumber(totalCreditNotesAmount, 2)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Adjusted Total</span>
                <span className="tabular-nums">€{formatNumber(Math.max(0, total - totalCreditNotesAmount), 2)}</span>
              </div>
            </>
          )}
          
          <div className="flex justify-between text-muted-foreground">
            <span>Paid</span>
            <span className="tabular-nums">€{formatNumber(totalPaid, 2)}</span>
          </div>
        </div>

        {/* Customer Section */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            <User className="h-3 w-3" />
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
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-muted-foreground truncate">{invoice.customers.email}</span>
              <button
                onClick={() => copyToClipboard(invoice.customers?.email || "", "Email")}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            <FileText className="h-3 w-3" />
            Invoice Details
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Hash className="h-3 w-3" />
              Number
            </span>
            <div className="flex items-center gap-1">
              <span className="font-medium">{invoice.invoice_number}</span>
              <button
                onClick={() => copyToClipboard(invoice.invoice_number, "Invoice number")}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3" />
              Issue Date
            </span>
            <span>{format(new Date((invoice as any).invoice_date || invoice.created_at), "dd MMM yyyy")}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Due Date
            </span>
            <span className={dueIndicator?.isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
              {format(new Date(invoice.due_date), "dd MMM yyyy")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceDetails;
