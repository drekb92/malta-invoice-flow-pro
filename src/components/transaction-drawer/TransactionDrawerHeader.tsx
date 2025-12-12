import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { TransactionType } from "./types";
import { StatusBadge, TypeBadge } from "./statusBadges";

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
  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-4 shrink-0">
        {/* Top row: Document type + Status badge aligned right */}
        <div className="flex items-center justify-between mb-2">
          <TypeBadge type={type} />
          <StatusBadge status={status} isIssued={isIssued} />
        </div>
        
        {/* Customer name - visually dominant */}
        <SheetTitle className="text-xl font-bold text-foreground leading-tight">
          {customerName}
        </SheetTitle>
        
        {/* Document number - secondary */}
        <p className="text-sm text-muted-foreground font-medium">{transactionNumber}</p>
      </SheetHeader>
      <Separator className="bg-border/60" />
    </>
  );
};