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
    <div className="shrink-0 px-5 py-4 border-t border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        {/* Left side: Secondary action (Download PDF) */}
        <Button
          variant="outline"
          size="sm"
          className="text-sm"
          onClick={onDownloadPdf}
          disabled={downloadingPdf || lineItemsCount === 0}
        >
          {downloadingPdf ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1.5" />
          )}
          {downloadingPdf ? "Generating..." : "PDF"}
        </Button>

        {/* Right side: Context actions + Primary action */}
        <div className="flex items-center gap-2">
          {/* INVOICE ACTIONS */}
          {type === "invoice" && (
            <>
              {remainingBalance > 0 && onAddPayment && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  onClick={() => {
                    onClose();
                    onAddPayment(transaction.id);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Payment
                </Button>
              )}
              
              {onIssueCreditNote && (transaction as InvoiceTransaction).is_issued && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm hidden sm:flex"
                  onClick={() => {
                    onClose();
                    onIssueCreditNote(transaction.id);
                  }}
                >
                  <Receipt className="h-4 w-4 mr-1.5" />
                  Credit Note
                </Button>
              )}
              
              {remainingBalance > 0 && onSendReminder && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm hidden sm:flex"
                  onClick={() => {
                    onClose();
                    onSendReminder(transaction.id);
                  }}
                >
                  <Bell className="h-4 w-4 mr-1.5" />
                  Remind
                </Button>
              )}
            </>
          )}

          {/* CREDIT NOTE ACTIONS */}
          {type === "credit_note" && !originalInvoice && onApplyCreditNote && (
            <Button
              variant="outline"
              size="sm"
              className="text-sm"
              onClick={() => {
                onClose();
                onApplyCreditNote(transaction.id);
              }}
            >
              <ArrowRight className="h-4 w-4 mr-1.5" />
              Apply
            </Button>
          )}

          {/* QUOTATION ACTIONS */}
          {type === "quotation" && (
            <>
              {transaction.status === "draft" && onSendQuote && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  onClick={() => {
                    onClose();
                    onSendQuote(transaction.id);
                  }}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Send
                </Button>
              )}
              
              {transaction.status !== "converted" && onConvertQuotation && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  onClick={() => {
                    onClose();
                    onConvertQuotation(transaction.id);
                  }}
                >
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  Convert
                </Button>
              )}
            </>
          )}

          {/* Primary action: View Full - Always available, right-most */}
          <Button size="sm" className="text-sm" onClick={onViewFull}>
            <ExternalLink className="h-4 w-4 mr-1.5" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
};
