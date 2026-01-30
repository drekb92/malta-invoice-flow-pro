import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { TransactionType } from "./types";
import { StatusBadge } from "./statusBadges";
import { format } from "date-fns";

interface TransactionDrawerHeaderProps {
  type: TransactionType;
  transactionNumber: string;
  customerName: string;
  status: string;
  isIssued?: boolean;
  lastSentAt?: string | null;
  lastSentChannel?: string | null;
}

export const TransactionDrawerHeader = ({
  type,
  transactionNumber,
  customerName,
  status,
  isIssued,
  lastSentAt,
  lastSentChannel,
}: TransactionDrawerHeaderProps) => {
  const getDocumentTypeLabel = () => {
    switch (type) {
      case 'credit_note': return 'Credit Note';
      case 'quotation': return 'Quotation';
      default: return 'Invoice';
    }
  };

  const formatChannel = (channel: string) => {
    if (channel === 'whatsapp') return 'WhatsApp';
    if (channel === 'email') return 'Email';
    return channel.charAt(0).toUpperCase() + channel.slice(1);
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
        
        {/* Customer name + delivery info */}
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-muted-foreground">{customerName}</p>
          {lastSentAt && (
            <p className="text-xs text-muted-foreground">
              Last sent: {format(new Date(lastSentAt), "dd MMM, HH:mm")} via {formatChannel(lastSentChannel || 'email')}
            </p>
          )}
        </div>
      </SheetHeader>
      <Separator className="bg-border/60" />
    </>
  );
};