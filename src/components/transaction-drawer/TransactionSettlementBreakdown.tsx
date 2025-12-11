import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { CreditNote, Payment, TransactionType } from "./types";
import { formatCurrency, getCreditNoteGrossAmount } from "./utils";

interface InvoiceSettlementBreakdownProps {
  creditNotes: CreditNote[];
  payments: Payment[];
  totalCredits: number;
  totalPayments: number;
  onClose: () => void;
}

export const InvoiceSettlementBreakdown = ({
  creditNotes,
  payments,
  totalCredits,
  totalPayments,
  onClose,
}: InvoiceSettlementBreakdownProps) => {
  if (creditNotes.length === 0 && payments.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Settlement Breakdown
      </h3>
      <div className="space-y-3">
        {/* Credit Notes Applied */}
        {creditNotes.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted-foreground">Credit Notes Applied</h4>
            <div className="space-y-1 ml-1.5">
              {creditNotes.map(cn => (
                <div
                  key={cn.id}
                  className="flex justify-between items-center py-1.5 px-2.5 bg-muted/30 rounded-md text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{cn.credit_note_number}</span>
                    <span className="text-muted-foreground"> · {format(new Date(cn.credit_note_date), "dd MMM")}</span>
                  </div>
                  <span className="font-medium text-destructive shrink-0 ml-2">
                    – {formatCurrency(getCreditNoteGrossAmount(cn))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payments Received */}
        {payments.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted-foreground">Payments Received</h4>
            <div className="space-y-1 ml-1.5">
              {payments.map(p => (
                <div
                  key={p.id}
                  className="flex justify-between items-center py-1.5 px-2.5 bg-muted/30 rounded-md text-xs"
                >
                  <div className="min-w-0">
                    <span>{format(new Date(p.payment_date!), "dd MMM yyyy")}</span>
                    {p.method && (
                      <span className="text-muted-foreground">
                        {" "}· {p.method.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-green-600 shrink-0 ml-2">{formatCurrency(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="border-t border-border pt-2 space-y-1">
          {totalCredits > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total Credits</span>
              <span className="font-medium text-destructive">– {formatCurrency(totalCredits)}</span>
            </div>
          )}
          {totalPayments > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total Payments</span>
              <span className="font-medium text-green-600">{formatCurrency(totalPayments)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface CreditNoteApplicationBreakdownProps {
  originalInvoice: { invoice_number: string } | null;
  originalInvoiceId: string | null;
  totalAmount: number;
  onClose: () => void;
}

export const CreditNoteApplicationBreakdown = ({
  originalInvoice,
  originalInvoiceId,
  totalAmount,
  onClose,
}: CreditNoteApplicationBreakdownProps) => {
  const navigate = useNavigate();

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Application Breakdown
      </h3>
      <div className="bg-muted/30 rounded-lg p-3">
        {originalInvoice ? (
          <>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Applied To:</h4>
            <div className="space-y-1.5 ml-1.5">
              <div className="flex justify-between items-center py-1.5 px-2.5 bg-muted/50 rounded-md text-xs">
                <button
                  className="font-medium text-primary hover:underline cursor-pointer"
                  onClick={() => {
                    if (originalInvoiceId) {
                      onClose();
                      navigate(`/invoices/${originalInvoiceId}`);
                    }
                  }}
                >
                  {originalInvoice.invoice_number}
                </button>
                <span className="font-medium text-destructive shrink-0 ml-2">
                  – {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-border text-xs">
              <span className="text-muted-foreground">Remaining Credit:</span>
              <span className="font-medium">€0.00</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            This credit note has not been applied to any invoice.
          </p>
        )}
      </div>
    </div>
  );
};
