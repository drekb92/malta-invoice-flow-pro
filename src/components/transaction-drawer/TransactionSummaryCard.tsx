import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { 
  TransactionType, 
  InvoiceTransaction, 
  CreditNoteTransaction, 
  QuotationTransaction,
} from "./types";
import { formatCurrency } from "./utils";
import { TransactionTotalsCard } from "./TransactionTotalsCard";

interface TransactionSummaryCardProps {
  type: TransactionType;
  transaction: InvoiceTransaction | CreditNoteTransaction | QuotationTransaction;
  totalAmount: number;
  totalCredits: number;
  totalPayments: number;
  remainingBalance: number;
  // Credit note specific (unified values from parent)
  creditNoteTotalApplied?: number;
  creditNoteRemainingCredit?: number;
}

export const TransactionSummaryCard = ({
  type,
  transaction,
  totalAmount,
  totalCredits,
  totalPayments,
  remainingBalance,
  creditNoteTotalApplied = 0,
  creditNoteRemainingCredit = 0,
}: TransactionSummaryCardProps) => {

  // Build rows and final row for each type
  const buildInvoiceTotals = () => {
    const rows: Array<{ label: string; value: number; type: "default" | "credit" | "payment" | "highlight" }> = [
      { label: "Original Amount", value: totalAmount, type: "highlight" },
    ];
    
    if (totalCredits > 0) {
      rows.push({ label: "Credit Notes Applied", value: totalCredits, type: "credit" });
    }
    if (totalPayments > 0) {
      rows.push({ label: "Payments Received", value: totalPayments, type: "payment" });
    }

    const finalStatus = remainingBalance === 0 ? "paid" : remainingBalance > 0 ? "due" : "credit";
    
    const finalValue = remainingBalance === 0 ? (
      <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-200 text-[11px] px-2 py-0.5 font-medium">
        Paid in full
      </Badge>
    ) : remainingBalance < 0 ? (
      <div className="text-right">
        <span className="text-sm font-bold text-green-600 tabular-nums">{formatCurrency(Math.abs(remainingBalance))}</span>
        <div className="text-[11px] text-green-600">Credit balance</div>
      </div>
    ) : remainingBalance;

    return { rows, finalRow: { label: "Balance Due", value: finalValue, status: finalStatus as "paid" | "due" | "credit" } };
  };

  const buildCreditNoteTotals = () => {
    const cn = transaction as CreditNoteTransaction;
    const rows = [
      { label: "Net Amount", value: cn.amount, type: "default" as const },
      { label: `VAT (${(cn.vat_rate * 100).toFixed(0)}%)`, value: cn.amount * cn.vat_rate, type: "default" as const },
    ];

    // Determine application status
    const isFullyApplied = creditNoteRemainingCredit === 0 && creditNoteTotalApplied > 0;
    const isPartiallyApplied = creditNoteRemainingCredit > 0 && creditNoteTotalApplied > 0;
    
    let statusLabel = "Not Applied";
    let statusClass = "text-muted-foreground";
    
    if (isFullyApplied) {
      statusLabel = "Fully Applied";
      statusClass = "text-green-600 dark:text-green-400";
    } else if (isPartiallyApplied) {
      statusLabel = "Partially Applied";
      statusClass = "text-amber-600 dark:text-amber-400";
    }

    const finalValue = (
      <div className="text-right">
        <span className="text-sm font-bold tabular-nums text-foreground">
          {formatCurrency(creditNoteRemainingCredit)}
        </span>
        <span className={`text-[11px] ml-1.5 ${statusClass}`}>({statusLabel})</span>
      </div>
    );

    return { 
      rows, 
      finalRow: { 
        label: "Remaining Credit", 
        value: finalValue, 
        status: isFullyApplied ? "paid" : isPartiallyApplied ? "credit" : "neutral" as "paid" | "credit" | "neutral"
      },
      reason: cn.reason,
    };
  };

  const buildQuotationTotals = () => {
    const quote = transaction as QuotationTransaction;
    const rows = [
      { label: "Net Amount", value: quote.amount || 0, type: "default" as const },
      { label: "VAT Amount", value: quote.vat_amount || 0, type: "default" as const },
    ];

    return { 
      rows, 
      finalRow: { label: "Quote Total", value: totalAmount, status: "neutral" as const },
      quote,
    };
  };

  const getSummaryLabel = () => {
    if (type === "invoice") return "Invoice Summary";
    if (type === "credit_note") return "Summary";
    return "Summary";
  };

  return (
    <div className="mt-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        {getSummaryLabel()}
      </h3>
      
      {type === "invoice" && (() => {
        const { rows, finalRow } = buildInvoiceTotals();
        return <TransactionTotalsCard rows={rows} finalRow={finalRow} />;
      })()}

      {type === "credit_note" && (() => {
        const { rows, finalRow, reason } = buildCreditNoteTotals();
        return (
          <div className="space-y-3">
            <TransactionTotalsCard rows={rows} finalRow={finalRow} />
            {reason && (
              <div className="bg-muted/30 border border-border/40 rounded-lg p-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reason</span>
                <p className="text-sm text-foreground mt-1">{reason}</p>
              </div>
            )}
          </div>
        );
      })()}

      {type === "quotation" && (() => {
        const { rows, finalRow, quote } = buildQuotationTotals();
        const issueDate = new Date(quote.issue_date);
        const validUntil = quote.valid_until ? new Date(quote.valid_until) : null;
        const isExpired = validUntil && new Date() > validUntil;
        
        return (
          <div className="space-y-3">
            <TransactionTotalsCard rows={rows} finalRow={finalRow} />
            <div className="bg-muted/30 border border-border/40 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Issue Date
                </span>
                <span className="font-medium text-foreground">{format(issueDate, "dd MMM yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Valid Until
                </span>
                <span className={`font-medium ${isExpired ? "text-destructive" : "text-foreground"}`}>
                  {validUntil ? format(validUntil, "dd MMM yyyy") : "—"}
                  {isExpired && <span className="text-[11px] ml-1">(Expired)</span>}
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};