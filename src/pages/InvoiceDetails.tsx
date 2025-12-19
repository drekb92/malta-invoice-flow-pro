import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
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
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
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

// Credit Note type for summary
interface CreditNoteSummary {
  id: string;
  credit_note_number: string;
  amount: number;
  vat_rate: number | null;
  reason: string;
}

// Invoice Summary Card Component
interface InvoiceSummaryCardProps {
  invoice: Invoice;
  invoiceTotals: InvoiceTotals | null;
  computedTotals: { net: number; vat: number; total: number };
  totalPaid: number;
  creditNotes: CreditNoteSummary[];
  getStatusBadge: (status: string) => string;
  discountInfo: { amount: number; isPercent: boolean; percentValue: number };
  subtotal: number;
}

const InvoiceSummaryCard = ({
  invoice,
  invoiceTotals,
  computedTotals,
  totalPaid,
  creditNotes,
  getStatusBadge,
  discountInfo,
  subtotal,
}: InvoiceSummaryCardProps) => {
  const total = invoiceTotals?.total_amount ?? computedTotals.total;
  const net = invoiceTotals?.net_amount ?? computedTotals.net;
  const vat = invoiceTotals?.vat_amount ?? computedTotals.vat;
  const isOverdue = invoice.status === "overdue" || (new Date(invoice.due_date) < new Date() && invoice.status !== "paid");
  
  // Calculate total credit notes amount (including VAT)
  const totalCreditNotesAmount = creditNotes.reduce((sum, cn) => {
    const netAmount = Number(cn.amount || 0);
    const vatRate = Number(cn.vat_rate || 0);
    return sum + netAmount + (netAmount * vatRate);
  }, 0);
  
  // Adjusted total = Original Total - Credit Notes
  const adjustedTotal = total - totalCreditNotesAmount;
  
  // Remaining balance = Adjusted Total - Payments
  const remainingBalance = adjustedTotal - totalPaid;
  const isSettled = remainingBalance <= 0;

  // Taxable amount (after discount)
  const taxable = subtotal - discountInfo.amount;

  return (
    <div 
      className="bg-white dark:bg-card border border-[#e5e7eb] dark:border-border rounded-[10px] p-5 max-w-[320px]"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
    >
      {/* Overdue Banner */}
      {isOverdue && !isSettled && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md px-3 py-1.5 mb-4 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          <span className="text-xs font-medium text-red-700 dark:text-red-300">Overdue: Please settle payment.</span>
        </div>
      )}

      {/* Totals Breakdown - Discount applied BEFORE VAT */}
      <div className="pb-4 border-b border-[#f1f5f9] dark:border-border space-y-2">
        <Badge className={`${getStatusBadge(invoice.status)} text-xs px-2 py-0.5 mb-2`}>
          {invoice.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
        </Badge>
        
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">€{formatNumber(subtotal, 2)}</span>
        </div>
        
        {discountInfo.amount > 0 && (
          <>
            <div className="flex justify-between text-xs text-destructive">
              <span>Discount{discountInfo.isPercent ? ` (${discountInfo.percentValue}%)` : ''}</span>
              <span className="tabular-nums">−€{formatNumber(discountInfo.amount, 2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Taxable Amount</span>
              <span className="tabular-nums">€{formatNumber(taxable, 2)}</span>
            </div>
          </>
        )}
        
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">VAT</span>
          <span className="tabular-nums">€{formatNumber(vat, 2)}</span>
        </div>
        
        <div className="flex justify-between pt-2 border-t border-[#f1f5f9] dark:border-border">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-bold tabular-nums">€{formatNumber(total, 2)}</span>
        </div>
        
        {discountInfo.amount > 0 && (
          <p className="text-[10px] text-muted-foreground">Discount applied before VAT</p>
        )}
      </div>

      {/* Credit Notes Applied */}
      {creditNotes.length > 0 && (
        <div className="py-4 pb-2 border-b border-[#f1f5f9] dark:border-border">
          <p className="text-sm font-medium text-foreground mb-2">Credit Notes Applied ({creditNotes.length})</p>
          <div className="space-y-1.5">
            {creditNotes.map((cn, index) => {
              const cnTotal = Number(cn.amount || 0) + (Number(cn.amount || 0) * Number(cn.vat_rate || 0));
              return (
                <div key={cn.id}>
                  {index > 0 && <div className="border-t border-[#f1f5f9] dark:border-border my-1.5" />}
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-foreground">{cn.credit_note_number}</span>
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">– €{formatNumber(cnTotal, 2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{cn.reason}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Adjusted Total */}
      {creditNotes.length > 0 && (
        <div className="py-4 border-b border-[#f1f5f9] dark:border-border bg-[#f7fdf9] dark:bg-green-950/20 -mx-5 px-5">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-foreground">Adjusted Total</span>
            <span className={`text-xl font-bold ${adjustedTotal > 0 ? "text-foreground" : "text-green-600 dark:text-green-400"}`}>
              €{formatNumber(Math.max(0, adjustedTotal), 2)}
            </span>
          </div>
        </div>
      )}

      {/* Customer */}
      <div className="py-4 border-b border-[#f1f5f9] dark:border-border">
        <p className="text-xs font-medium text-muted-foreground mb-1">Customer</p>
        <p className="text-sm font-medium text-foreground">{invoice.customers?.name || "Unknown Customer"}</p>
      </div>

      {/* Invoice Dates */}
      <div className="py-4 border-b border-[#f1f5f9] dark:border-border space-y-2">
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Issue Date</span>
          <span className="text-sm text-foreground">
            {format(new Date((invoice as any).invoice_date || invoice.created_at), "dd/MM/yyyy")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Due Date</span>
          <span className={`text-sm font-medium ${isOverdue && !isSettled ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}>
            {format(new Date(invoice.due_date), "dd/MM/yyyy")}
          </span>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="pt-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Total Paid</span>
          <span className="text-sm font-medium text-foreground">€{formatNumber(totalPaid, 2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Balance Due</span>
          <span className={`text-sm font-bold ${isSettled ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            €{formatNumber(Math.max(0, remainingBalance), 2)}
          </span>
        </div>
        {isSettled && (
          <div className="flex justify-end mt-2">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Settled
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

const InvoiceDetails = () => {
  // 🔑 IMPORTANT: use `id`, not `invoice_id`
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

  // Payment states
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    method: "bank_transfer",
  });

  // Credit notes state
  const [creditNotes, setCreditNotes] = useState<CreditNoteSummary[]>([]);

  const { toast } = useToast();

  // Load template using unified hook
  const { template, isLoading: templateLoading } = useInvoiceTemplate();

  // Load company and banking settings
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();

  // Fetch payments for this invoice
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

  // Fetch credit notes for this invoice
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
        // Fetch invoice header
        const { data: invoiceData, error: invoiceError } = await supabase
          .from("invoices")
          .select(
            `
            *,
            customers (
              name, email, address, address_line1, address_line2, locality, post_code, vat_number, phone
            )
          `,
          )
          .eq("id", id)
          .eq("user_id", user.id)
          .single();

        if (invoiceError) throw invoiceError;

        // Fetch invoice items
        const { data: itemsData, error: itemsError } = await (supabase as any)
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", id);

        if (itemsError) throw itemsError;

        // Fetch invoice totals
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

        // Load audit trail if invoice is issued
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
      return {
        amount: round2(subtotal * (pct / 100)),
        isPercent: true,
        percentValue: pct,
      };
    } else {
      const amt = Math.min(Math.max(raw, 0), subtotal);
      return { amount: round2(amt), isPercent: false, percentValue: 0 };
    }
  }, [invoice, subtotal]);

  const handleDownload = async () => {
    if (!invoice) return;

    console.log("[InvoiceDetails] Starting PDF download - using UnifiedInvoiceLayout for consistency");

    // Validate settings
    if (!companySettings?.company_name) {
      toast({
        title: "Company Settings Required",
        description: "Please complete your company information in Settings.",
        variant: "destructive",
      });
      return;
    }

    // Validate template is loaded
    if (!template) {
      console.error("[InvoiceDetails] Template not loaded");
      toast({
        title: "Template not ready",
        description: "Please wait for template to load and try again.",
        variant: "destructive",
      });
      return;
    }

    console.log("[InvoiceDetails] Using template:", {
      id: template.id,
      name: template.name,
      layout: template.layout,
      font_family: template.font_family,
    });

    try {
      const filename = `Invoice-${invoice.invoice_number}`;
      await downloadPdfFromFunction(filename, template.font_family);

      console.log("[InvoiceDetails] PDF generated successfully");
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
    const body = `Dear ${invoice.customers?.name || "Customer"},%0D%0A%0D%0AThis is a friendly reminder that invoice ${
      invoice.invoice_number
    } for €${formatNumber(computedTotals.total, 2)} is due on ${format(
      new Date(invoice.due_date),
      "dd/MM/yyyy",
    )}.%0D%0A%0D%0AThank you.`;
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
    const message = `Payment Reminder: Invoice ${invoice.invoice_number} of €${formatNumber(
      computedTotals.total,
      2,
    )} is due on ${format(new Date(invoice.due_date), "dd/MM/yyyy")}.`;
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
        setInvoice({
          ...invoice,
          ...(updatedInvoice as any),
        });
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
      setInvoice({
        ...invoice,
        ...(updatedInvoice as any),
      });
    }

    // Refresh credit notes
    fetchCreditNotes();

    const auditResult = await invoiceService.getInvoiceAuditTrail(id);
    if (auditResult.success && auditResult.auditTrail) {
      setAuditTrail(auditResult.auditTrail);
    }
  };

  const getImmutabilityBadge = () => {
    if (!invoice) return null;

    const isIssued = (invoice as any).is_issued;

    if (isIssued) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
          <Shield className="h-3 w-3" />
          ISSUED (Immutable)
        </Badge>
      );
    }

    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        DRAFT (Editable)
      </Badge>
    );
  };

  // Payment calculations
  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  // Calculate total credit notes amount (including VAT)
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

  // Handle adding a payment
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
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">Invoice {invoice.invoice_number}</h1>
                    {getImmutabilityBadge()}
                  </div>
                  <p className="text-muted-foreground">Invoice details and line items</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!(invoice as any).is_issued && (
                  <Button
                    onClick={handleIssueInvoice}
                    disabled={isIssuing}
                    className="bg-green-600 hover:bg-green-700"
                    aria-label="Issue invoice"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isIssuing ? "Issuing..." : "Issue Invoice"}
                  </Button>
                )}
                {(invoice as any).is_issued && (
                  <Button onClick={handleCreateCreditNote} variant="outline" aria-label="Create credit note">
                    <FileText className="h-4 w-4 mr-2" />
                    Create Credit Note
                  </Button>
                )}
                <Button onClick={handleDownload} aria-label="Download invoice PDF" title="Download invoice PDF">
                  <Download className="h-4 w-4" />
                  <span className="sr-only">Download</span>
                  <span className="hidden sm:inline">Download PDF</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleEmailReminder}
                  aria-label="Send email reminder"
                  title="Send email reminder"
                >
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">Email Reminder</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleWhatsAppReminder}
                  aria-label="Send WhatsApp reminder"
                  title="Send WhatsApp reminder"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4">
          {/* Malta VAT Compliance Alert */}
          {(invoice as any).is_issued ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800 rounded-md px-3 py-1.5 mb-4">
              <Shield className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400">
                <span className="font-medium text-green-800 dark:text-green-300">VAT Compliant</span> — Issued {format(new Date((invoice as any).issued_at), "dd/MM/yyyy HH:mm")}. Immutable. Use credit note to correct.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800 rounded-md px-3 py-1.5 mb-4">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                <span className="font-medium text-yellow-800 dark:text-yellow-300">Draft</span> — Editable. Once issued, becomes immutable per Malta VAT.
              </p>
            </div>
          )}

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-4 min-w-0">
              {/* Mobile Summary Card - shown above Line Items on mobile/tablet */}
              <div className="lg:hidden">
                <InvoiceSummaryCard 
                  invoice={invoice}
                  invoiceTotals={invoiceTotals}
                  computedTotals={computedTotals}
                  totalPaid={totalPaid}
                  creditNotes={creditNotes}
                  getStatusBadge={getStatusBadge}
                  discountInfo={discountInfo}
                  subtotal={subtotal}
                />
              </div>

              {/* Invoice Header */}
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm font-semibold">Invoice Information</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Invoice Number</label>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{invoice.invoice_number}</p>
                        <Badge className={`${getStatusBadge(invoice.status)} text-[10px] px-1.5 py-0 h-4`}>
                          {invoice.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Customer</label>
                      <p>{invoice.customers?.name || "Unknown Customer"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Issue Date</label>
                      <p>{format(new Date((invoice as any).invoice_date || invoice.created_at), "dd/MM/yyyy")}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                      <p>{format(new Date(invoice.due_date), "dd/MM/yyyy")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm font-semibold">Line Items</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#f1f5f9] dark:bg-muted/50">
                        <TableHead className="py-1.5 text-xs">Description</TableHead>
                        <TableHead className="py-1.5 text-xs text-right">Qty</TableHead>
                        <TableHead className="py-1.5 text-xs text-right">Unit</TableHead>
                        <TableHead className="py-1.5 text-xs text-right">Price</TableHead>
                        <TableHead className="py-1.5 text-xs text-right">VAT</TableHead>
                        <TableHead className="py-1.5 text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-3 text-sm">
                            No line items found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        invoiceItems.map((item, index) => {
                          const lineTotal = item.quantity * item.unit_price;
                          return (
                            <TableRow key={item.id} className={index % 2 === 0 ? "bg-[#fafafa] dark:bg-muted/20" : ""}>
                              <TableCell className="py-1.5 font-medium text-sm">{item.description}</TableCell>
                              <TableCell className="py-1.5 text-sm text-right">{item.quantity}</TableCell>
                              <TableCell className="py-1.5 text-sm text-right">{item.unit || "-"}</TableCell>
                              <TableCell className="py-1.5 text-sm text-right">€{formatNumber(item.unit_price, 2)}</TableCell>
                              <TableCell className="py-1.5 text-sm text-right">{formatNumber(item.vat_rate * 100, 0)}%</TableCell>
                              <TableCell className="py-1.5 text-sm text-right font-medium">€{formatNumber(lineTotal, 2)}</TableCell>
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
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm font-semibold">Invoice Totals</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-2 pt-0">
                  <div className="space-y-0.5 max-w-xs ml-auto text-sm">
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Net Amount:</span>
                      <span className="font-medium">€{formatNumber(invoiceTotals?.net_amount ?? computedTotals.net, 2)}</span>
                    </div>
                    {discountInfo.amount > 0 && (
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Discount:</span>
                        <span className="font-medium">
                          —€{formatNumber(discountInfo.amount, 2)}
                          {discountInfo.isPercent && <> ({formatNumber(discountInfo.percentValue, 2)}%)</>}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">VAT Amount:</span>
                      <span className="font-medium">€{formatNumber(invoiceTotals?.vat_amount ?? computedTotals.vat, 2)}</span>
                    </div>
                    <div className="bg-[#eefbf3] dark:bg-green-950/30 -mx-2 px-2 py-1 rounded mt-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-base">Total Amount:</span>
                        <span className="font-bold text-base">€{formatNumber(invoiceTotals?.total_amount ?? computedTotals.total, 2)}</span>
                      </div>
                    </div>
                    {/* Payment Summary */}
                    <div className="border-t pt-1 mt-1 space-y-0.5">
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Total Paid:</span>
                        <span className="font-medium text-muted-foreground">€{formatNumber(totalPaid, 2)}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className={`font-bold ${remainingBalance <= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          €{formatNumber(Math.max(0, remainingBalance), 2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card>
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment History
                  </CardTitle>
                  <Button onClick={() => setShowPaymentDialog(true)} size="sm" className="h-6 text-[10px] px-2">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Payment
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  {payments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-3 text-sm">No payments recorded yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="py-2 text-xs">Date</TableHead>
                          <TableHead className="py-2 text-xs">Amount</TableHead>
                          <TableHead className="py-2 text-xs">Method</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="py-2 text-sm">{format(new Date(payment.payment_date), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="py-2 text-sm font-medium">€{formatNumber(payment.amount, 2)}</TableCell>
                            <TableCell className="py-2 text-sm">{getMethodLabel(payment.method)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Audit Trail */}
              {(invoice as any).is_issued && auditTrail.length > 0 && (
                <Card>
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Audit Trail (Malta VAT Compliance)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-2 pt-0">
                    <div className="relative ml-2">
                      {/* Vertical timeline line */}
                      <div className="absolute left-0 top-1 bottom-1 w-px bg-border" />
                      <div className="space-y-1">
                        {auditTrail.map((entry, index) => (
                          <div key={entry.id || index} className="relative pl-4 py-0.5">
                            {/* Timeline dot */}
                            <div className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-primary -translate-x-[3px]" />
                            <div className="flex items-baseline gap-2">
                              <p className="font-medium text-xs">
                                {entry.action === "issued" && "Invoice Issued"}
                                {entry.action === "credit_note_created" && "Credit Note Created"}
                                {entry.action === "created" && "Invoice Created"}
                                {entry.action === "correction_note_added" && "Correction Note Added"}
                              </p>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(entry.timestamp), "dd/MM/yyyy HH:mm")}
                              </span>
                            </div>
                            {entry.new_data && (
                              <p className="text-[10px] text-muted-foreground">
                                {entry.action === "issued" && `Invoice #${entry.new_data.invoice_number} locked`}
                                {entry.action === "credit_note_created" && `${entry.new_data.credit_note_number} for €${formatNumber(entry.new_data.amount, 2)}`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 pt-1 border-t">
                      Maintained for Malta VAT compliance.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Desktop Floating Summary Card */}
            <div className="hidden lg:block w-80 flex-shrink-0">
              <div className="sticky top-[90px]">
                <InvoiceSummaryCard 
                  invoice={invoice}
                  invoiceTotals={invoiceTotals}
                  computedTotals={computedTotals}
                  totalPaid={totalPaid}
                  creditNotes={creditNotes}
                  getStatusBadge={getStatusBadge}
                  discountInfo={discountInfo}
                  subtotal={subtotal}
                />
              </div>
            </div>
          </div>
        </main>
      </div>

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
          --m-right: ${
            typeof (template as any)?.margin_right === "number" ? `${(template as any).margin_right}cm` : "1.2cm"
          };
          --m-bottom: ${
            typeof (template as any)?.margin_bottom === "number" ? `${(template as any).margin_bottom}cm` : "1.2cm"
          };
          --m-left: ${
            typeof (template as any)?.margin_left === "number" ? `${(template as any).margin_left}cm` : "1.2cm"
          };

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
              Record a payment for invoice {invoice?.invoice_number}. Remaining balance: €
              {formatNumber(remainingBalance, 2)}
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
                onChange={(e) =>
                  setNewPayment({
                    ...newPayment,
                    payment_date: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={newPayment.method}
                onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
              >
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

export default InvoiceDetails;
