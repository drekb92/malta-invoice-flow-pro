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

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge className={`${getTypeBadgeClass(type)} text-[10px] px-1.5 py-0.5 font-medium`}>
            {typeLabel}
          </Badge>
          <Badge className={`${statusBadge.className} text-[10px] px-1.5 py-0.5`}>
            {StatusIcon && <StatusIcon className="h-2.5 w-2.5 mr-0.5" />}
            {statusBadge.label}
          </Badge>
        </div>
        <SheetTitle className="text-base" style={{ fontWeight: 600 }}>
          {transactionNumber}
        </SheetTitle>
        <p className="text-xs text-muted-foreground">{customerName}</p>
      </SheetHeader>
      <Separator />
    </>
  );
};
