import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { TransactionType } from "./types";
import { StatusBadge } from "./statusBadges";

interface TransactionDrawerHeaderProps {
  type: TransactionType;
  transactionNumber: string;
  customerName: string;
  status: string;
  isIssued?: boolean;
}

export const TransactionDrawerHeader = ({
  type,
  transactionNumber,
  customerName,
  status,
  isIssued,
}: TransactionDrawerHeaderProps) => {
  const getDocumentTypeLabel = () => {
    switch (type) {
      case 'credit_note': return 'Credit Note';
      case 'quotation': return 'Quotation';
      default: return 'Invoice';
    }
  };

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-4 shrink-0">
        {/* Top row: Document type • number + Status badge aligned right */}
        <div className="flex items-center justify-between">
          <SheetTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span>{getDocumentTypeLabel()}</span>
            <span className="text-muted-foreground font-normal">•</span>
            <span>{transactionNumber}</span>
            <StatusBadge status={status} isIssued={isIssued} />
          </SheetTitle>
        </div>
        
        {/* Customer name - secondary */}
        <p className="text-sm text-muted-foreground">{customerName}</p>
      </SheetHeader>
      <Separator className="bg-border/60" />
    </>
  );
};