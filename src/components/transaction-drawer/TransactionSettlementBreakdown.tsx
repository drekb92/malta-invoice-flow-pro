import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Receipt, Banknote, ArrowDownRight } from "lucide-react";
import type { CreditNote, Payment } from "./types";
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
}: InvoiceSettlementBreakdownProps) => {
  if (creditNotes.length === 0 && payments.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        <ArrowDownRight className="h-3.5 w-3.5" />
        Settlement Breakdown
      </h3>
      <div className="bg-card border border-border/60 rounded-lg p-4 space-y-4 shadow-sm">
        {/* Credit Notes Applied */}
        {creditNotes.length > 0 && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              Credit Notes Applied
            </h4>
            <div className="space-y-1.5">
              {creditNotes.map(cn => (
                <div
                  key={cn.id}
                  className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded-md text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{cn.credit_note_number}</span>
                    <span className="text-muted-foreground text-xs"> · {format(new Date(cn.credit_note_date), "dd MMM")}</span>
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
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Banknote className="h-3.5 w-3.5" />
              Payments Received
            </h4>
            <div className="space-y-1.5">
              {payments.map(p => (
                <div
                  key={p.id}
                  className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded-md text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-foreground">{format(new Date(p.payment_date!), "dd MMM yyyy")}</span>
                    {p.method && (
                      <span className="text-muted-foreground text-xs">
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
        <div className="border-t border-border/60 pt-3 space-y-1.5">
          {totalCredits > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Credits</span>
              <span className="font-medium text-destructive">– {formatCurrency(totalCredits)}</span>
            </div>
          )}
          {totalPayments > 0 && (
            <div className="flex justify-between text-sm">
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
  appliedDate: string | null;
  remainingCredit?: number;
  onClose: () => void;
}

export const CreditNoteApplicationBreakdown = ({
  originalInvoice,
  originalInvoiceId,
  totalAmount,
  appliedDate,
  remainingCredit = originalInvoice ? 0 : totalAmount,
  onClose,
}: CreditNoteApplicationBreakdownProps) => {
  const navigate = useNavigate();
  
  const totalApplied = totalAmount - remainingCredit;
  
  const getContextualNote = () => {
    if (remainingCredit === 0 && totalApplied > 0) {
      return "This credit note has been fully applied to invoices.";
    }
    if (remainingCredit > 0 && totalApplied > 0) {
      return "This credit note is partially applied. Remaining credit may be allocated to other invoices.";
    }
    return "This credit note has not been applied yet.";
  };

  return (
    <div className="mt-5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        <ArrowDownRight className="h-3.5 w-3.5" />
        Applied To Invoices
      </h3>
      <div className="bg-card border border-border/60 rounded-lg p-4 shadow-sm">
        {originalInvoice ? (
          <>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Applied To:</h4>
            <div className="space-y-1.5">
              <div className="py-2.5 px-3 bg-muted/30 rounded-md">
                <div className="flex justify-between items-center text-sm">
                  <button
                    className="font-medium text-primary hover:underline cursor-pointer text-left"
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
                    – {formatCurrency(totalApplied)}
                  </span>
                </div>
                {appliedDate && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Applied on: {format(new Date(appliedDate), "dd MMM yyyy")}
                  </p>
                )}
              </div>
            </div>
            
            {/* Contextual note */}
            <p className="text-[11px] text-muted-foreground mt-3 mb-3">
              {getContextualNote()}
            </p>
            
            <div className="flex justify-between items-center pt-3 border-t border-border/60 text-sm">
              <span className="text-muted-foreground">Remaining Credit:</span>
              <span className="font-medium text-foreground">{formatCurrency(remainingCredit)}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-3">
            {getContextualNote()}
          </p>
        )}
      </div>
    </div>
  );
};
