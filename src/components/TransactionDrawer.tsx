import { format } from "date-fns";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  CheckCircle,
  Clock,
  CreditCard,
  AlertCircle,
  Loader2,
  Receipt,
  Banknote,
  ExternalLink,
  Download,
  ChevronDown,
  Shield,
  ArrowRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateInvoicePDFWithTemplate } from "@/lib/pdfGenerator";
import type { InvoiceData } from "@/services/pdfService";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TransactionType = "invoice" | "credit_note" | "quotation";

interface BaseTransaction {
  id: string;
  status: string;
}

interface InvoiceTransaction extends BaseTransaction {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  amount?: number;
  vat_amount?: number;
  is_issued: boolean;
  customer_id?: string;
}

interface CreditNoteTransaction extends BaseTransaction {
  credit_note_number: string;
  credit_note_date: string;
  amount: number;
  vat_rate: number;
  reason: string;
  original_invoice_id?: string;
  customer_id?: string;
}

interface QuotationTransaction extends BaseTransaction {
  quotation_number: string;
  issue_date: string;
  valid_until: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  customer_id?: string;
}

type Transaction = InvoiceTransaction | CreditNoteTransaction | QuotationTransaction;

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string | null;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  vat_number: string | null;
}

interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  amount: number;
  vat_rate: number;
  reason: string;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  method: string | null;
}

interface TimelineEvent {
  id: string;
  type: "created" | "issued" | "sent" | "accepted" | "converted" | "credit_note" | "payment" | "paid";
  date: string;
  title: string;
  amount?: number;
}

interface TransactionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  type: TransactionType;
  onConvertQuotation?: (quotationId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

const getCreditNoteGrossAmount = (cn: CreditNote): number => {
  return cn.amount * (1 + cn.vat_rate);
};

// Status badge configs
const getInvoiceStatusBadge = (status: string, isIssued?: boolean) => {
  if (status === "paid") {
    return { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle, label: "Paid" };
  }
  if (status === "partially_paid") {
    return { className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: CreditCard, label: "Partially Paid" };
  }
  if (isIssued) {
    return { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Shield, label: "Issued" };
  }
  if (status === "overdue") {
    return { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: AlertCircle, label: "Overdue" };
  }
  return { className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: FileText, label: "Draft" };
};

const getCreditNoteStatusBadge = (status: string) => {
  const variants: Record<string, { className: string; label: string }> = {
    draft: { className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", label: "Draft" },
    issued: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Issued" },
    applied: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Applied" },
  };
  return variants[status] || variants.draft;
};

const getQuotationStatusBadge = (status: string) => {
  const variants: Record<string, { className: string; label: string }> = {
    draft: { className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", label: "Draft" },
    sent: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Sent" },
    accepted: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Accepted" },
    converted: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Converted" },
    expired: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Expired" },
  };
  return variants[status] || variants.draft;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const TransactionDrawer = ({
  open,
  onOpenChange,
  transaction,
  type,
  onConvertQuotation,
}: TransactionDrawerProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Data states
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [originalInvoice, setOriginalInvoice] = useState<{ invoice_number: string } | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open && transaction) {
      loadData();
    }
  }, [open, transaction?.id, type]);

  const loadData = async () => {
    if (!transaction) return;
    setLoading(true);

    try {
      if (type === "invoice") {
        await loadInvoiceData(transaction as InvoiceTransaction);
      } else if (type === "credit_note") {
        await loadCreditNoteData(transaction as CreditNoteTransaction);
      } else if (type === "quotation") {
        await loadQuotationData(transaction as QuotationTransaction);
      }
    } catch (error) {
      console.error("Error loading transaction data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceData = async (invoice: InvoiceTransaction) => {
    const [creditNotesResult, paymentsResult, itemsResult, detailsResult] = await Promise.all([
      supabase
        .from("credit_notes")
        .select("id, credit_note_number, credit_note_date, amount, vat_rate, reason")
        .eq("original_invoice_id", invoice.id)
        .order("credit_note_date", { ascending: true }),
      supabase
        .from("payments")
        .select("id, payment_date, amount, method")
        .eq("invoice_id", invoice.id)
        .order("payment_date", { ascending: true }),
      supabase
        .from("invoice_items")
        .select("id, description, quantity, unit_price, vat_rate, unit")
        .eq("invoice_id", invoice.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("invoices")
        .select("created_at, issued_at, customer_id, customers(id, name, email, address, vat_number)")
        .eq("id", invoice.id)
        .maybeSingle(),
    ]);

    if (creditNotesResult.data) {
      setCreditNotes(creditNotesResult.data.map(cn => ({
        ...cn,
        amount: Number(cn.amount),
        vat_rate: Number(cn.vat_rate ?? 0),
      })));
    }
    if (paymentsResult.data) setPayments(paymentsResult.data);
    if (itemsResult.data) {
      setLineItems(itemsResult.data.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        vat_rate: Number(item.vat_rate),
      })));
    }
    if (detailsResult.data) {
      setCreatedAt(detailsResult.data.created_at);
      setIssuedAt(detailsResult.data.issued_at);
      const data = detailsResult.data as { customers: Customer | null };
      if (data.customers) setCustomer(data.customers);
    }
  };

  const loadCreditNoteData = async (creditNote: CreditNoteTransaction) => {
    const [itemsResult, detailsResult, invoiceResult] = await Promise.all([
      supabase
        .from("credit_note_items")
        .select("id, description, quantity, unit_price, vat_rate, unit")
        .eq("credit_note_id", creditNote.id),
      (supabase as any)
        .from("credit_notes")
        .select("created_at, customer_id, customers(id, name, email, address, vat_number)")
        .eq("id", creditNote.id)
        .maybeSingle(),
      creditNote.original_invoice_id
        ? supabase
            .from("invoices")
            .select("invoice_number")
            .eq("id", creditNote.original_invoice_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (itemsResult.data) {
      setLineItems(itemsResult.data.map((item: any) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        vat_rate: Number(item.vat_rate),
      })));
    }
    if (detailsResult.data) {
      setCreatedAt(detailsResult.data.created_at);
      const data = detailsResult.data as { customers: Customer | null };
      if (data.customers) setCustomer(data.customers);
    }
    if (invoiceResult.data) {
      setOriginalInvoice(invoiceResult.data);
    }
  };

  const loadQuotationData = async (quotation: QuotationTransaction) => {
    const [itemsResult, detailsResult] = await Promise.all([
      supabase
        .from("quotation_items")
        .select("id, description, quantity, unit_price, vat_rate, unit")
        .eq("quotation_id", quotation.id),
      supabase
        .from("quotations")
        .select("created_at, customer_id, customers(id, name, email, address, vat_number)")
        .eq("id", quotation.id)
        .maybeSingle(),
    ]);

    if (itemsResult.data) {
      setLineItems(itemsResult.data.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        vat_rate: Number(item.vat_rate),
      })));
    }
    if (detailsResult.data) {
      setCreatedAt(detailsResult.data.created_at);
      const data = detailsResult.data as { customers: Customer | null };
      if (data.customers) setCustomer(data.customers);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Computed Values
  // ─────────────────────────────────────────────────────────────────────────

  const getTransactionNumber = () => {
    if (type === "invoice") return (transaction as InvoiceTransaction).invoice_number;
    if (type === "credit_note") return (transaction as CreditNoteTransaction).credit_note_number;
    return (transaction as QuotationTransaction).quotation_number;
  };

  const getTotalAmount = () => {
    if (type === "invoice") return (transaction as InvoiceTransaction).total_amount;
    if (type === "credit_note") {
      const cn = transaction as CreditNoteTransaction;
      return cn.amount * (1 + cn.vat_rate);
    }
    return (transaction as QuotationTransaction).total_amount || (transaction as QuotationTransaction).amount;
  };

  const getTransactionDate = () => {
    if (type === "invoice") return (transaction as InvoiceTransaction).invoice_date;
    if (type === "credit_note") return (transaction as CreditNoteTransaction).credit_note_date;
    return (transaction as QuotationTransaction).issue_date;
  };

  const getStatusBadge = () => {
    if (!transaction) return { className: "", label: "", icon: undefined };
    if (type === "invoice") {
      const inv = transaction as InvoiceTransaction;
      return getInvoiceStatusBadge(inv.status, inv.is_issued);
    }
    if (type === "credit_note") {
      return { ...getCreditNoteStatusBadge(transaction.status), icon: undefined };
    }
    return { ...getQuotationStatusBadge(transaction.status), icon: undefined };
  };

  // Invoice-specific calculations
  const totalCredits = creditNotes.reduce((sum, cn) => sum + getCreditNoteGrossAmount(cn), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingBalance = type === "invoice" ? getTotalAmount() - totalCredits - totalPayments : 0;

  // Timeline
  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    if (!transaction) return [];
    const events: TimelineEvent[] = [];

    if (createdAt) {
      events.push({
        id: `created-${transaction.id}`,
        type: "created",
        date: createdAt,
        title: `${type === "invoice" ? "Invoice" : type === "credit_note" ? "Credit Note" : "Quotation"} created`,
      });
    }

    if (type === "invoice") {
      const inv = transaction as InvoiceTransaction;
      if (inv.is_issued && issuedAt) {
        events.push({
          id: `issued-${inv.id}`,
          type: "issued",
          date: issuedAt,
          title: "Invoice issued",
        });
      }

      creditNotes.forEach(cn => {
        events.push({
          id: `cn-${cn.id}`,
          type: "credit_note",
          date: cn.credit_note_date,
          title: `Credit Note ${cn.credit_note_number}`,
          amount: getCreditNoteGrossAmount(cn),
        });
      });

      payments.forEach(p => {
        events.push({
          id: `payment-${p.id}`,
          type: "payment",
          date: p.payment_date,
          title: `Payment${p.method ? ` (${p.method.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())})` : ""}`,
          amount: Number(p.amount),
        });
      });

      if (remainingBalance === 0 && payments.length > 0) {
        const lastPayment = [...payments].sort((a, b) =>
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )[0];
        events.push({
          id: `paid-${inv.id}`,
          type: "paid",
          date: lastPayment.payment_date,
          title: "Marked as paid",
        });
      }
    }

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return events;
  }, [transaction, type, createdAt, issuedAt, creditNotes, payments, remainingBalance]);

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  const handleViewFull = () => {
    if (!transaction) return;
    onOpenChange(false);
    if (type === "invoice") navigate(`/invoices/${transaction.id}`);
    else if (type === "credit_note") navigate(`/credit-notes/${transaction.id}`);
    else navigate(`/quotations/${transaction.id}`);
  };

  const handleDownloadPdf = async () => {
    if (!transaction || !customer || lineItems.length === 0) {
      toast({ title: "Cannot generate PDF", description: "Missing data.", variant: "destructive" });
      return;
    }

    setDownloadingPdf(true);
    try {
      const netTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const vatTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price * item.vat_rate, 0);
      const grandTotal = netTotal + vatTotal;

      let docNumber = "";
      let docDate = "";
      let docType: InvoiceData["documentType"] = "INVOICE";

      if (type === "invoice") {
        const inv = transaction as InvoiceTransaction;
        docNumber = inv.invoice_number;
        docDate = inv.invoice_date;
        docType = "INVOICE";
      } else if (type === "credit_note") {
        const cn = transaction as CreditNoteTransaction;
        docNumber = cn.credit_note_number;
        docDate = cn.credit_note_date;
        docType = "CREDIT NOTE";
      } else {
        const q = transaction as QuotationTransaction;
        docNumber = q.quotation_number;
        docDate = q.issue_date;
        docType = "QUOTATION";
      }

      const invoiceData: InvoiceData = {
        invoiceNumber: docNumber,
        invoiceDate: docDate,
        dueDate: type === "invoice" ? (transaction as InvoiceTransaction).due_date : docDate,
        documentType: docType,
        customer: {
          name: customer.name,
          email: customer.email || undefined,
          address: customer.address || undefined,
          vat_number: customer.vat_number || undefined,
        },
        items: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          unit: item.unit || undefined,
        })),
        totals: { netTotal, vatTotal, grandTotal },
      };

      const filename = `${docType.replace(" ", "-")}-${docNumber}`;
      await generateInvoicePDFWithTemplate(invoiceData, filename);

      toast({ title: "PDF downloaded", description: `${docType} ${docNumber} has been downloaded.` });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Download failed", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleConvert = () => {
    if (type === "quotation" && onConvertQuotation && transaction) {
      onOpenChange(false);
      onConvertQuotation(transaction.id);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render Helpers
  // ─────────────────────────────────────────────────────────────────────────

  if (!transaction) return null;

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  const getBalanceDisplay = () => {
    if (remainingBalance === 0) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-200">
          Paid in full
        </Badge>
      );
    }
    if (remainingBalance < 0) {
      return (
        <div className="text-right">
          <span className="text-base font-semibold text-green-600">{formatCurrency(Math.abs(remainingBalance))}</span>
          <div className="text-[10px] text-green-600">Credit in favour</div>
        </div>
      );
    }
    return <span className="text-base font-semibold text-destructive">{formatCurrency(remainingBalance)}</span>;
  };

  const getTimelineIcon = (eventType: TimelineEvent["type"]) => {
    switch (eventType) {
      case "created":
      case "issued":
        return <FileText className="h-3 w-3" />;
      case "credit_note":
        return <Receipt className="h-3 w-3" />;
      case "payment":
      case "paid":
        return <Banknote className="h-3 w-3" />;
      case "sent":
      case "accepted":
      case "converted":
        return <CheckCircle className="h-3 w-3" />;
    }
  };

  const getTimelineColor = (eventType: TimelineEvent["type"]) => {
    switch (eventType) {
      case "created":
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
      case "issued":
      case "sent":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300";
      case "credit_note":
        return "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300";
      case "payment":
      case "paid":
      case "accepted":
        return "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300";
      case "converted":
        return "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300";
    }
  };

  const typeLabel = type === "invoice" ? "Invoice" : type === "credit_note" ? "Credit Note" : "Quote";
  
  const getTypeBadgeClass = () => {
    if (type === "invoice") return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    if (type === "credit_note") return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[420px] p-0 flex flex-col">
        {/* Fixed Header */}
        <SheetHeader className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`${getTypeBadgeClass()} text-[10px] px-1.5 py-0.5 font-medium`}>
              {typeLabel}
            </Badge>
            <Badge className={`${statusBadge.className} text-[10px] px-1.5 py-0.5`}>
              {StatusIcon && <StatusIcon className="h-2.5 w-2.5 mr-0.5" />}
              {statusBadge.label}
            </Badge>
          </div>
          <SheetTitle className="text-base" style={{ fontWeight: 600 }}>
            {getTransactionNumber()}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">{customer?.name || "Loading..."}</p>
        </SheetHeader>

        <Separator />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : (
          <>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Line Items */}
              {lineItems.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Line Items</h3>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Description</th>
                          <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-10">Qty</th>
                          <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-16">Price</th>
                          <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-12">VAT</th>
                          <th className="text-right px-2.5 py-1.5 font-medium text-muted-foreground w-18">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, idx) => {
                          const lineTotal = item.quantity * item.unit_price * (1 + item.vat_rate);
                          return (
                            <tr key={item.id} className={idx !== lineItems.length - 1 ? "border-b border-border/50" : ""}>
                              <td className="px-2.5 py-1.5 text-foreground truncate max-w-[100px]" title={item.description}>
                                {item.description}
                              </td>
                              <td className="text-right px-2 py-1.5 text-muted-foreground">{item.quantity}</td>
                              <td className="text-right px-2 py-1.5 text-muted-foreground">{formatCurrency(item.unit_price)}</td>
                              <td className="text-right px-2 py-1.5 text-muted-foreground">{(item.vat_rate * 100).toFixed(0)}%</td>
                              <td className="text-right px-2.5 py-1.5 font-medium">{formatCurrency(lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  B. DOCUMENT SUMMARY BLOCK - Adapts per type
                  ═══════════════════════════════════════════════════════════════ */}
              <div className="mt-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {type === "invoice" ? "Invoice" : type === "credit_note" ? "Credit Note" : "Quote"} Summary
                </h3>
                <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                  {/* INVOICE SUMMARY */}
                  {type === "invoice" && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Original Amount</span>
                        <span className="font-medium">{formatCurrency(getTotalAmount())}</span>
                      </div>
                      
                      {totalCredits > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Credit Notes Applied</span>
                            <span className="text-destructive font-medium">– {formatCurrency(totalCredits)}</span>
                          </div>
                          <div className="ml-1.5 space-y-1">
                            {creditNotes.map(cn => (
                              <div
                                key={cn.id}
                                className="flex justify-between items-center py-1.5 px-2 bg-muted/50 rounded text-xs"
                              >
                                <div className="min-w-0">
                                  <span className="font-medium">{cn.credit_note_number}</span>
                                  <span className="text-muted-foreground"> · {format(new Date(cn.credit_note_date), "dd MMM")}</span>
                                </div>
                                <span className="text-destructive shrink-0 ml-2">
                                  – {formatCurrency(getCreditNoteGrossAmount(cn))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {totalPayments > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Payments Received</span>
                            <span className="text-green-600 font-medium">– {formatCurrency(totalPayments)}</span>
                          </div>
                          <div className="ml-1.5 space-y-1">
                            {payments.map(p => (
                              <div
                                key={p.id}
                                className="flex justify-between items-center py-1.5 px-2 bg-muted/50 rounded text-xs"
                              >
                                <div className="min-w-0">
                                  <span>{format(new Date(p.payment_date!), "dd MMM yyyy")}</span>
                                  {p.method && (
                                    <span className="text-muted-foreground">
                                      {" "}· {p.method.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                  )}
                                </div>
                                <span className="text-green-600 shrink-0 ml-2">{formatCurrency(Number(p.amount))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Separator className="my-1.5" />
                      <div
                        className={`flex justify-between items-center -mx-3 px-3 py-2 rounded-md ${
                          remainingBalance === 0
                            ? "bg-green-50 dark:bg-green-950/30"
                            : remainingBalance > 0
                            ? "bg-red-50 dark:bg-red-950/30"
                            : "bg-green-50 dark:bg-green-950/30"
                        }`}
                      >
                        <span className="text-sm font-medium">Remaining Balance</span>
                        {getBalanceDisplay()}
                      </div>
                    </>
                  )}

                  {/* CREDIT NOTE SUMMARY */}
                  {type === "credit_note" && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Credit Note Amount</span>
                        <span className="font-medium">{formatCurrency(getTotalAmount())}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Net Amount</span>
                        <span>{formatCurrency((transaction as CreditNoteTransaction).amount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT ({((transaction as CreditNoteTransaction).vat_rate * 100).toFixed(0)}%)</span>
                        <span>{formatCurrency((transaction as CreditNoteTransaction).amount * (transaction as CreditNoteTransaction).vat_rate)}</span>
                      </div>
                      
                      <Separator className="my-1.5" />
                      
                      {originalInvoice && (
                        <div className="flex justify-between text-sm items-center">
                          <span className="text-muted-foreground">Applied to Invoice</span>
                          <button
                            className="font-medium text-primary hover:underline cursor-pointer"
                            onClick={() => {
                              const invId = (transaction as CreditNoteTransaction).original_invoice_id;
                              if (invId) {
                                onOpenChange(false);
                                navigate(`/invoices/${invId}`);
                              }
                            }}
                          >
                            {originalInvoice.invoice_number}
                          </button>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Reason</span>
                        <span className="text-right max-w-[180px] truncate" title={(transaction as CreditNoteTransaction).reason}>
                          {(transaction as CreditNoteTransaction).reason}
                        </span>
                      </div>
                      
                      <div className="-mx-3 px-3 py-2 mt-1 rounded-md bg-muted/50 flex justify-between items-center">
                        <span className="text-sm font-medium">Status</span>
                        <Badge className={`${statusBadge.className} text-[10px] px-1.5 py-0.5`}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                    </>
                  )}

                  {/* QUOTATION SUMMARY */}
                  {type === "quotation" && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Quote Value</span>
                        <span className="font-semibold">{formatCurrency(getTotalAmount())}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Net Amount</span>
                        <span>{formatCurrency((transaction as QuotationTransaction).amount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT Amount</span>
                        <span>{formatCurrency((transaction as QuotationTransaction).vat_amount || 0)}</span>
                      </div>
                      
                      <Separator className="my-1.5" />
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Issue Date</span>
                        <span className="font-medium">
                          {format(new Date((transaction as QuotationTransaction).issue_date), "dd MMM yyyy")}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valid Until</span>
                        <span className="font-medium">
                          {(transaction as QuotationTransaction).valid_until
                            ? format(new Date((transaction as QuotationTransaction).valid_until), "dd MMM yyyy")
                            : "—"}
                        </span>
                      </div>
                      
                      <div className="-mx-3 px-3 py-2 mt-1 rounded-md bg-muted/50 flex justify-between items-center">
                        <span className="text-sm font-medium">Acceptance Status</span>
                        <Badge className={`${statusBadge.className} text-[10px] px-1.5 py-0.5`}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════
                  C. ACTIVITY TIMELINE (shared, collapsible)
                  ═══════════════════════════════════════════════════════════════ */}
              {timelineEvents.length > 0 && (
                <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen} className="mt-4">
                  <CollapsibleTrigger className="flex items-center justify-between w-full group">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity Timeline</h3>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${timelineOpen ? "rotate-180" : ""}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="relative">
                      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                      <div className="space-y-2">
                        {timelineEvents.map(event => (
                          <div key={event.id} className="flex items-start gap-2.5 relative">
                            <div
                              className={`relative z-10 flex items-center justify-center w-5 h-5 rounded-full ${getTimelineColor(
                                event.type
                              )}`}
                            >
                              {getTimelineIcon(event.type)}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs truncate">{event.title}</span>
                                {event.amount && (
                                  <span
                                    className={`text-[10px] font-medium ${
                                      event.type === "credit_note" ? "text-destructive" : "text-green-600"
                                    }`}
                                  >
                                    {event.type === "credit_note" ? "–" : ""}
                                    {formatCurrency(event.amount)}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {format(new Date(event.date), "dd/MM/yyyy HH:mm")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            {/* Fixed Footer Actions */}
            <div className="shrink-0 px-5 py-3 border-t border-border bg-background">
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                {type === "quotation" && transaction.status !== "converted" && onConvertQuotation && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto order-3 sm:order-1"
                    onClick={handleConvert}
                  >
                    <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                    Convert to Invoice
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto order-2"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf || lineItems.length === 0}
                >
                  {downloadingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {downloadingPdf ? "Generating..." : "Download PDF"}
                </Button>
                <Button size="sm" className="w-full sm:w-auto order-1 sm:order-3" onClick={handleViewFull}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  View Full {typeLabel}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
