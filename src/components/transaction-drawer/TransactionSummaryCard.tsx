import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { 
  TransactionType, 
  InvoiceTransaction, 
  CreditNoteTransaction, 
  QuotationTransaction,
  StatusBadgeConfig
} from "./types";
import { formatCurrency } from "./utils";

interface TransactionSummaryCardProps {
  type: TransactionType;
  transaction: InvoiceTransaction | CreditNoteTransaction | QuotationTransaction;
  totalAmount: number;
  totalCredits: number;
  totalPayments: number;
  remainingBalance: number;
  statusBadge: StatusBadgeConfig;
}

export const TransactionSummaryCard = ({
  type,
  transaction,
  totalAmount,
  totalCredits,
  totalPayments,
  remainingBalance,
  statusBadge,
}: TransactionSummaryCardProps) => {
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

  const title = type === "invoice" ? "Invoice" : type === "credit_note" ? "Credit Note" : "Quote";

  return (
    <div className="mt-3">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {title} Summary
      </h3>
      <div className="bg-muted/40 rounded-lg p-3 space-y-2">
        {/* INVOICE SUMMARY */}
        {type === "invoice" && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original Amount</span>
              <span className="font-medium">{formatCurrency(totalAmount)}</span>
            </div>
            
            {totalCredits > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credit Notes Applied</span>
                <span className="text-destructive font-medium">– {formatCurrency(totalCredits)}</span>
              </div>
            )}

            {totalPayments > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payments Received</span>
                <span className="text-green-600 font-medium">– {formatCurrency(totalPayments)}</span>
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
        {type === "credit_note" && (() => {
          const cn = transaction as CreditNoteTransaction;
          return (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credit Note Amount</span>
                <span className="font-medium">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Net Amount</span>
                <span>{formatCurrency(cn.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT ({(cn.vat_rate * 100).toFixed(0)}%)</span>
                <span>{formatCurrency(cn.amount * cn.vat_rate)}</span>
              </div>
              
              <Separator className="my-1.5" />
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reason</span>
                <span className="text-right max-w-[180px] truncate" title={cn.reason}>
                  {cn.reason}
                </span>
              </div>
              
              <div className="-mx-3 px-3 py-2 mt-1 rounded-md bg-muted/50 flex justify-between items-center">
                <span className="text-sm font-medium">Status</span>
                <Badge className={`${statusBadge.className} text-[10px] px-1.5 py-0.5`}>
                  {statusBadge.label}
                </Badge>
              </div>
            </>
          );
        })()}

        {/* QUOTATION SUMMARY */}
        {type === "quotation" && (() => {
          const quote = transaction as QuotationTransaction;
          const issueDate = new Date(quote.issue_date);
          const validUntil = quote.valid_until ? new Date(quote.valid_until) : null;
          const validityDays = validUntil
            ? Math.ceil((validUntil.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          const isExpired = validUntil && new Date() > validUntil;
          
          return (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Quote Value</span>
                <span className="font-semibold">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Net Amount</span>
                <span>{formatCurrency(quote.amount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT Amount</span>
                <span>{formatCurrency(quote.vat_amount || 0)}</span>
              </div>
              
              <Separator className="my-1.5" />
              
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Issue Date
                </span>
                <span className="font-medium">
                  {format(issueDate, "dd MMM yyyy")}
                </span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Valid Until
                </span>
                <span className={`font-medium ${isExpired ? "text-destructive" : ""}`}>
                  {validUntil ? format(validUntil, "dd MMM yyyy") : "—"}
                  {isExpired && <span className="text-[10px] ml-1">(Expired)</span>}
                </span>
              </div>
              {validityDays && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Validity Period</span>
                  <span>{validityDays} days</span>
                </div>
              )}
              
              <div className="-mx-3 px-3 py-2 mt-1 rounded-md bg-muted/50 flex justify-between items-center">
                <span className="text-sm font-medium">Quote Status</span>
                <Badge className={`${statusBadge.className} text-[10px] px-1.5 py-0.5`}>
                  {statusBadge.label}
                </Badge>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};
