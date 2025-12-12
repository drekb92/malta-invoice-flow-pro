import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { TransactionType, StatusBadgeConfig } from "./types";
import { getTypeBadgeClass, getTypeLabel } from "./utils";

interface TransactionDrawerHeaderProps {
  type: TransactionType;
  transactionNumber: string;
  customerName: string;
  statusBadge: StatusBadgeConfig;
}

export const TransactionDrawerHeader = ({
  type,
  transactionNumber,
  customerName,
  statusBadge,
}: TransactionDrawerHeaderProps) => {
  const StatusIcon = statusBadge.icon;
  const typeLabel = getTypeLabel(type);

  // Only show type badge for credit notes and quotations (invoice is obvious from number)
  const showTypeBadge = type !== "invoice";

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          {showTypeBadge && (
            <Badge className={`${getTypeBadgeClass(type)} text-[10px] px-2 py-0.5 font-semibold`}>
              {typeLabel}
            </Badge>
          )}
          <Badge className={`${statusBadge.className} text-[10px] px-2 py-0.5 font-medium`}>
            {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
            {statusBadge.label}
          </Badge>
        </div>
        <SheetTitle className="text-lg font-semibold text-foreground">
          {transactionNumber}
        </SheetTitle>
        <p className="text-sm text-muted-foreground">{customerName}</p>
      </SheetHeader>
      <Separator className="bg-border/60" />
    </>
  );
};
