import { Download, Loader2, ExternalLink, Plus, Receipt, Bell, ArrowRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TransactionType, InvoiceTransaction, Transaction } from "./types";
import { getTypeLabel } from "./utils";

interface TransactionFooterActionsProps {
  type: TransactionType;
  transaction: Transaction;
  downloadingPdf: boolean;
  lineItemsCount: number;
  remainingBalance: number;
  originalInvoice: { invoice_number: string } | null;
  onDownloadPdf: () => void;
  onViewFull: () => void;
  onAddPayment?: (invoiceId: string) => void;
  onIssueCreditNote?: (invoiceId: string) => void;
  onSendReminder?: (invoiceId: string) => void;
  onConvertQuotation?: (quotationId: string) => void;
  onSendQuote?: (quotationId: string) => void;
  onApplyCreditNote?: (creditNoteId: string) => void;
  onClose: () => void;
}

export const TransactionFooterActions = ({
  type,
  transaction,
  downloadingPdf,
  lineItemsCount,
  remainingBalance,
  originalInvoice,
  onDownloadPdf,
  onViewFull,
  onAddPayment,
  onIssueCreditNote,
  onSendReminder,
  onConvertQuotation,
  onSendQuote,
  onApplyCreditNote,
  onClose,
}: TransactionFooterActionsProps) => {
  const typeLabel = getTypeLabel(type);

  return (
    <div className="shrink-0 px-5 py-3 border-t border-border bg-background">
      <div className="flex flex-wrap justify-end gap-2">
        {/* Download PDF - Always available */}
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadPdf}
          disabled={downloadingPdf || lineItemsCount === 0}
        >
          {downloadingPdf ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 mr-1.5" />
          )}
          {downloadingPdf ? "Generating..." : "Download PDF"}
        </Button>

        {/* INVOICE ACTIONS */}
        {type === "invoice" && (
          <>
            {remainingBalance > 0 && onAddPayment && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onAddPayment(transaction.id);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Payment
              </Button>
            )}
            
            {onIssueCreditNote && (transaction as InvoiceTransaction).is_issued && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onIssueCreditNote(transaction.id);
                }}
              >
                <Receipt className="h-3.5 w-3.5 mr-1.5" />
                Issue Credit Note
              </Button>
            )}
            
            {remainingBalance > 0 && onSendReminder && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onSendReminder(transaction.id);
                }}
              >
                <Bell className="h-3.5 w-3.5 mr-1.5" />
                Send Reminder
              </Button>
            )}
          </>
        )}

        {/* CREDIT NOTE ACTIONS */}
        {type === "credit_note" && (
          <>
            {!originalInvoice && onApplyCreditNote && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onApplyCreditNote(transaction.id);
                }}
              >
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                Apply to Invoice
              </Button>
            )}
          </>
        )}

        {/* QUOTATION ACTIONS */}
        {type === "quotation" && (
          <>
            {transaction.status === "draft" && onSendQuote && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onSendQuote(transaction.id);
                }}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send Quote
              </Button>
            )}
            
            {transaction.status !== "converted" && onConvertQuotation && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onConvertQuotation(transaction.id);
                }}
              >
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                Convert to Invoice
              </Button>
            )}
          </>
        )}

        {/* View Full - Always available */}
        <Button size="sm" onClick={onViewFull}>
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          View Full {typeLabel}
        </Button>
      </div>
    </div>
  );
};
