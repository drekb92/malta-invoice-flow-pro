import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Receipt, Banknote, FileText } from "lucide-react";
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
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
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

// ─────────────────────────────────────────────────────────────────────────────
// Credit Note Reference Section - Uses same layout as Invoice Settlement
// ─────────────────────────────────────────────────────────────────────────────

interface CreditNoteApplicationBreakdownProps {
  originalInvoice: { invoice_number: string } | null;
  originalInvoiceId: string | null;
  totalAmount: number;
  totalApplied: number;
  remainingCredit: number;
  appliedDate: string | null;
  onClose: () => void;
}

export const CreditNoteApplicationBreakdown = ({
  originalInvoice,
  originalInvoiceId,
  totalApplied,
  remainingCredit,
  appliedDate,
  onClose,
}: CreditNoteApplicationBreakdownProps) => {
  const navigate = useNavigate();
  
  if (!originalInvoice) return null;

  return (
    <div className="mt-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Applied To
      </h3>
      <div className="bg-card border border-border/60 rounded-lg p-4 space-y-4 shadow-sm">
        {/* Applied Invoice - Same structure as credit notes in Invoice Settlement */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Invoice
          </h4>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded-md text-sm">
              <div className="min-w-0">
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
                {appliedDate && (
                  <span className="text-muted-foreground text-xs"> · {format(new Date(appliedDate), "dd MMM")}</span>
                )}
              </div>
              <span className="font-medium text-destructive shrink-0 ml-2">
                – {formatCurrency(totalApplied)}
              </span>
            </div>
          </div>
        </div>

        {/* Totals - Same structure as Invoice Settlement */}
        <div className="border-t border-border/60 pt-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount Applied</span>
            <span className="font-medium text-destructive">– {formatCurrency(totalApplied)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Remaining Credit</span>
            <span className="font-medium text-foreground">{formatCurrency(remainingCredit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Quotation Reference Section - For converted quotes
// ─────────────────────────────────────────────────────────────────────────────

interface QuotationConversionBreakdownProps {
  convertedInvoice: { invoice_number: string; id: string } | null;
  convertedDate: string | null;
  onClose: () => void;
}

export const QuotationConversionBreakdown = ({
  convertedInvoice,
  convertedDate,
  onClose,
}: QuotationConversionBreakdownProps) => {
  const navigate = useNavigate();
  
  if (!convertedInvoice) return null;

  return (
    <div className="mt-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Converted To
      </h3>
      <div className="bg-card border border-border/60 rounded-lg p-4 space-y-4 shadow-sm">
        {/* Converted Invoice - Same structure as Invoice Settlement */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Invoice
          </h4>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded-md text-sm">
              <div className="min-w-0">
                <button
                  className="font-medium text-primary hover:underline cursor-pointer text-left"
                  onClick={() => {
                    onClose();
                    navigate(`/invoices/${convertedInvoice.id}`);
                  }}
                >
                  {convertedInvoice.invoice_number}
                </button>
                {convertedDate && (
                  <span className="text-muted-foreground text-xs"> · {format(new Date(convertedDate), "dd MMM")}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
