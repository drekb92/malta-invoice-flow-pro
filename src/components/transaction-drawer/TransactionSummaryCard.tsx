import { format } from "date-fns";
import { Calendar, Clock, Receipt, FileText, ClipboardList } from "lucide-react";
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
        <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-0.5">
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

  const getIcon = () => {
    if (type === "invoice") return <FileText className="h-3.5 w-3.5" />;
    if (type === "credit_note") return <Receipt className="h-3.5 w-3.5" />;
    return <ClipboardList className="h-3.5 w-3.5" />;
  };

  const title = type === "invoice" ? "Summary" : type === "credit_note" ? "Summary" : "Summary";

  return (
    <div className="mt-5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {getIcon()}
        {title}
      </h3>
      <div className="bg-card border border-border/60 rounded-lg p-4 space-y-3 shadow-sm">
        {/* INVOICE SUMMARY */}
        {type === "invoice" && (
          <>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Original Amount</span>
              <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
            </div>
            
            {totalCredits > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Credit Notes Applied</span>
                <span className="text-destructive font-medium">– {formatCurrency(totalCredits)}</span>
              </div>
            )}

            {totalPayments > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Payments Received</span>
                <span className="text-green-600 font-medium">– {formatCurrency(totalPayments)}</span>
              </div>
            )}

            <Separator className="my-2" />
            <div
              className={`flex justify-between items-center -mx-4 -mb-4 px-4 py-3 rounded-b-lg ${
                remainingBalance === 0
                  ? "bg-green-50/80 dark:bg-green-950/30"
                  : remainingBalance > 0
                  ? "bg-red-50/80 dark:bg-red-950/30"
                  : "bg-green-50/80 dark:bg-green-950/30"
              }`}
            >
              <span className="text-sm font-semibold">Remaining Balance</span>
              {getBalanceDisplay()}
            </div>
          </>
        )}

        {/* CREDIT NOTE SUMMARY */}
        {type === "credit_note" && (() => {
          const cn = transaction as CreditNoteTransaction;
          return (
            <>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Credit Note Amount</span>
                <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Net Amount</span>
                <span className="text-foreground">{formatCurrency(cn.amount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">VAT ({(cn.vat_rate * 100).toFixed(0)}%)</span>
                <span className="text-foreground">{formatCurrency(cn.amount * cn.vat_rate)}</span>
              </div>
              
              <Separator className="my-2" />
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Reason</span>
                <span className="text-right max-w-[180px] truncate text-foreground" title={cn.reason}>
                  {cn.reason}
                </span>
              </div>
              
              <div className="-mx-4 -mb-4 px-4 py-3 mt-2 rounded-b-lg bg-muted/40 flex justify-between items-center">
                <span className="text-sm font-semibold">Status</span>
                <Badge className={`${statusBadge.className} text-xs px-2 py-0.5`}>
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
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Quote Value</span>
                <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Net Amount</span>
                <span className="text-foreground">{formatCurrency(quote.amount || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">VAT Amount</span>
                <span className="text-foreground">{formatCurrency(quote.vat_amount || 0)}</span>
              </div>
              
              <Separator className="my-2" />
              
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Issue Date
                </span>
                <span className="font-medium text-foreground">
                  {format(issueDate, "dd MMM yyyy")}
                </span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Valid Until
                </span>
                <span className={`font-medium ${isExpired ? "text-destructive" : "text-foreground"}`}>
                  {validUntil ? format(validUntil, "dd MMM yyyy") : "—"}
                  {isExpired && <span className="text-[10px] ml-1">(Expired)</span>}
                </span>
              </div>
              {validityDays && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Validity Period</span>
                  <span className="text-foreground">{validityDays} days</span>
                </div>
              )}
              
              <div className="-mx-4 -mb-4 px-4 py-3 mt-2 rounded-b-lg bg-muted/40 flex justify-between items-center">
                <span className="text-sm font-semibold">Quote Status</span>
                <Badge className={`${statusBadge.className} text-xs px-2 py-0.5`}>
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
