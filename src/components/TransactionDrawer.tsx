import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateInvoicePDFWithTemplate } from "@/lib/pdfGenerator";
import type { InvoiceData } from "@/services/pdfService";

// Import reusable components
import {
  TransactionType,
  Transaction,
  InvoiceTransaction,
  CreditNoteTransaction,
  QuotationTransaction,
  LineItem,
  Customer,
  CreditNote,
  Payment,
  TimelineEvent,
  getCreditNoteGrossAmount,
  getInvoiceStatusBadge,
  getCreditNoteStatusBadge,
  getQuotationStatusBadge,
} from "./transaction-drawer";

import { TransactionDrawerHeader } from "./transaction-drawer/TransactionDrawerHeader";
import { TransactionLineItems } from "./transaction-drawer/TransactionLineItems";
import { TransactionSummaryCard } from "./transaction-drawer/TransactionSummaryCard";
import { TransactionActivityTimeline } from "./transaction-drawer/TransactionActivityTimeline";
import { InvoiceSettlementBreakdown, CreditNoteApplicationBreakdown } from "./transaction-drawer/TransactionSettlementBreakdown";
import { TransactionFooterActions } from "./transaction-drawer/TransactionFooterActions";

// Re-export types for external use
export type { TransactionType, Transaction, InvoiceTransaction, CreditNoteTransaction, QuotationTransaction };

interface TransactionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  type: TransactionType;
  onConvertQuotation?: (quotationId: string) => void;
  onAddPayment?: (invoiceId: string) => void;
  onIssueCreditNote?: (invoiceId: string) => void;
  onSendReminder?: (invoiceId: string) => void;
  onSendQuote?: (quotationId: string) => void;
  onApplyCreditNote?: (creditNoteId: string) => void;
}

export const TransactionDrawer = ({
  open,
  onOpenChange,
  transaction,
  type,
  onConvertQuotation,
  onAddPayment,
  onIssueCreditNote,
  onSendReminder,
  onSendQuote,
  onApplyCreditNote,
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
    if (!transaction) return 0;
    if (type === "invoice") return (transaction as InvoiceTransaction).total_amount;
    if (type === "credit_note") {
      const cn = transaction as CreditNoteTransaction;
      return cn.amount * (1 + cn.vat_rate);
    }
    return (transaction as QuotationTransaction).total_amount || (transaction as QuotationTransaction).amount;
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
  const remainingBalance = type === "invoice" && transaction ? getTotalAmount() - totalCredits - totalPayments : 0;

  // Credit Note-specific calculations (unified logic)
  const creditNoteAmount = type === "credit_note" && transaction ? getTotalAmount() : 0;
  const creditNoteTotalApplied = type === "credit_note" && originalInvoice ? creditNoteAmount : 0;
  const creditNoteRemainingCredit = creditNoteAmount - creditNoteTotalApplied;

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

  const handleClose = () => onOpenChange(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (!transaction) return null;

  const statusBadge = getStatusBadge();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[420px] p-0 flex flex-col">
        {/* Shared Header */}
        <TransactionDrawerHeader
          type={type}
          transactionNumber={getTransactionNumber()}
          customerName={customer?.name || "Loading..."}
          statusBadge={statusBadge}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : (
          <>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-1">
              {/* A. Shared Line Items */}
              <TransactionLineItems items={lineItems} />

              {/* B. Shared Summary Card (adapts per type) */}
              <TransactionSummaryCard
                type={type}
                transaction={transaction}
                totalAmount={getTotalAmount()}
                totalCredits={totalCredits}
                totalPayments={totalPayments}
                remainingBalance={remainingBalance}
                statusBadge={statusBadge}
                creditNoteTotalApplied={creditNoteTotalApplied}
                creditNoteRemainingCredit={creditNoteRemainingCredit}
              />

              {/* Settlement Breakdown (Invoice Only) */}
              {type === "invoice" && (
                <InvoiceSettlementBreakdown
                  creditNotes={creditNotes}
                  payments={payments}
                  totalCredits={totalCredits}
                  totalPayments={totalPayments}
                  onClose={handleClose}
                />
              )}

              {/* Credit Note Application Breakdown (CN Only) */}
              {type === "credit_note" && (
                <CreditNoteApplicationBreakdown
                  originalInvoice={originalInvoice}
                  originalInvoiceId={(transaction as CreditNoteTransaction).original_invoice_id || null}
                  totalAmount={creditNoteAmount}
                  totalApplied={creditNoteTotalApplied}
                  remainingCredit={creditNoteRemainingCredit}
                  appliedDate={(transaction as CreditNoteTransaction).credit_note_date}
                  onClose={handleClose}
                />
              )}

              {/* C. Shared Activity Timeline */}
              <TransactionActivityTimeline events={timelineEvents} />
            </div>

            {/* Shared Footer Actions (dynamic per type) */}
            <TransactionFooterActions
              type={type}
              transaction={transaction}
              downloadingPdf={downloadingPdf}
              lineItemsCount={lineItems.length}
              remainingBalance={remainingBalance}
              originalInvoice={originalInvoice}
              onDownloadPdf={handleDownloadPdf}
              onViewFull={handleViewFull}
              onAddPayment={onAddPayment}
              onIssueCreditNote={onIssueCreditNote}
              onSendReminder={onSendReminder}
              onConvertQuotation={onConvertQuotation}
              onSendQuote={onSendQuote}
              onApplyCreditNote={onApplyCreditNote}
              onClose={handleClose}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
