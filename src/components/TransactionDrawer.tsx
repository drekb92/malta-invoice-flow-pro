import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { useDocumentSendLogs } from "@/hooks/useDocumentSendLogs";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
import type { InvoiceData } from "@/types/pdf";

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
  computeOutstandingAmount,
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
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [lastSentChannel, setLastSentChannel] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfData, setPdfData] = useState<InvoiceData | null>(null);

  // Load template, company, and banking settings for PDF generation
  const { template } = useInvoiceTemplate();
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();

  // Fetch send logs for quotations (and optionally invoices/credit notes)
  const documentType = type === "invoice" ? "invoice" : type === "credit_note" ? "credit_note" : "quotation";
  const { lastEmailSent, lastWhatsAppSent } = useDocumentSendLogs(documentType, transaction?.id || "");

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
        .eq("invoice_id", invoice.id)
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
        .select("created_at, issued_at, last_sent_at, last_sent_channel, customer_id, customers(id, name, email, address, address_line1, address_line2, locality, post_code, vat_number)")
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
      setLastSentAt(detailsResult.data.last_sent_at || null);
      setLastSentChannel(detailsResult.data.last_sent_channel || null);
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
        .select("created_at, customer_id, customers(id, name, email, address, address_line1, address_line2, locality, post_code, vat_number)")
        .eq("id", creditNote.id)
        .maybeSingle(),
      creditNote.invoice_id
        ? supabase
            .from("invoices")
            .select("invoice_number")
            .eq("id", creditNote.invoice_id)
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
        .select("created_at, customer_id, customers(id, name, email, address, address_line1, address_line2, locality, post_code, vat_number)")
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



  // Invoice-specific calculations
  const totalCredits = creditNotes.reduce((sum, cn) => sum + getCreditNoteGrossAmount(cn), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const invoiceTotal = type === "invoice" && transaction ? getTotalAmount() : 0;
  const outstandingAmount = computeOutstandingAmount(invoiceTotal, totalPayments);
  const remainingBalance = type === "invoice" && transaction ? invoiceTotal - totalCredits - totalPayments : 0;

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
    else navigate(`/quotations/${transaction.id}/edit`);
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!transaction || !customer || lineItems.length === 0) {
      toast({ title: "Cannot generate PDF", description: "Missing data.", variant: "destructive" });
      return;
    }

    if (!companySettings?.company_name) {
      toast({
        title: "Company Settings Required",
        description: "Please complete your company information in Settings before downloading PDFs.",
        variant: "destructive",
      });
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
      let dueDate = "";

      if (type === "invoice") {
        const inv = transaction as InvoiceTransaction;
        docNumber = inv.invoice_number;
        docDate = inv.invoice_date;
        dueDate = inv.due_date;
        docType = "INVOICE";
      } else if (type === "credit_note") {
        const cn = transaction as CreditNoteTransaction;
        docNumber = cn.credit_note_number;
        docDate = cn.credit_note_date;
        dueDate = cn.credit_note_date;
        docType = "CREDIT NOTE";
      } else {
        const q = transaction as QuotationTransaction;
        docNumber = q.quotation_number;
        docDate = q.issue_date;
        dueDate = q.valid_until || q.issue_date;
        docType = "QUOTATION";
      }

      const invoiceData: InvoiceData = {
        invoiceNumber: docNumber,
        invoiceDate: docDate,
        dueDate: dueDate,
        documentType: docType,
        customer: {
          name: customer.name,
          email: customer.email || undefined,
          address: customer.address || undefined,
          address_line1: customer.address_line1 || undefined,
          address_line2: customer.address_line2 || undefined,
          locality: customer.locality || undefined,
          post_code: customer.post_code || undefined,
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

      // Set PDF data to trigger hidden container render
      setPdfData(invoiceData);

      // Wait for next frame to ensure DOM is updated
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 100));

      const filename = `${docType.replace(" ", "-")}-${docNumber}`;
      await downloadPdfFromFunction(filename, template?.font_family);

      toast({ title: "PDF downloaded", description: `${docType} ${docNumber} has been downloaded.` });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Download failed", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
      setPdfData(null);
    }
  }, [transaction, customer, lineItems, type, companySettings, template, toast]);

  const handleClose = () => onOpenChange(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (!transaction) return null;

  

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[540px] p-0 flex flex-col">
          {/* Shared Header */}
          <TransactionDrawerHeader
            type={type}
            transactionNumber={getTransactionNumber()}
            customerName={customer?.name || "Loading..."}
            status={transaction.status}
            isIssued={type === "invoice" ? (transaction as InvoiceTransaction).is_issued : undefined}
            lastSentAt={type === "invoice" ? lastSentAt : null}
            lastSentChannel={type === "invoice" ? lastSentChannel : null}
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
                  outstandingAmount={outstandingAmount}
                  creditNoteTotalApplied={creditNoteTotalApplied}
                  creditNoteRemainingCredit={creditNoteRemainingCredit}
                  lastEmailSent={lastEmailSent}
                  lastWhatsAppSent={lastWhatsAppSent}
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
                    originalInvoiceId={(transaction as CreditNoteTransaction).invoice_id || null}
                    totalAmount={creditNoteAmount}
                    totalApplied={creditNoteTotalApplied}
                    remainingCredit={creditNoteRemainingCredit}
                    appliedDate={(transaction as CreditNoteTransaction).credit_note_date || null}
                    onClose={handleClose}
                  />
                )}

                {/* Activity Timeline (always last in scrollable area) */}
                <TransactionActivityTimeline events={timelineEvents} />
              </div>

              {/* Footer Actions */}
              <TransactionFooterActions
                type={type}
                transaction={transaction}
                downloadingPdf={downloadingPdf}
                lineItemsCount={lineItems.length}
                remainingBalance={remainingBalance}
                originalInvoice={originalInvoice}
                isIssued={type === "invoice" ? (transaction as InvoiceTransaction).is_issued : true}
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

      {/* Hidden PDF preview for Edge HTML engine */}
      {pdfData && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <UnifiedInvoiceLayout
            id="invoice-preview-root"
            variant="pdf"
            invoiceData={pdfData}
            documentType={pdfData.documentType}
            companySettings={companySettings ? {
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
            } : undefined}
            bankingSettings={bankingSettings ? {
              bankName: bankingSettings.bank_name,
              accountName: bankingSettings.bank_account_name,
              swiftCode: bankingSettings.bank_swift_code,
              iban: bankingSettings.bank_iban,
            } : undefined}
            templateSettings={template ? {
              primaryColor: template.primary_color,
              accentColor: template.accent_color,
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
            } : undefined}
          />
        </div>
      )}
    </>
  );
};
