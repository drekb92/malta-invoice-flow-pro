import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Unified status color system
const STATUS_STYLES = {
  // Universal statuses
  draft: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  issued: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800",
  paid: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800",
  partially_paid: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-800",
  overdue: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800",
  
  // Quote-specific
  sent: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800",
  accepted: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800",
  converted: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-800",
  expired: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800",
  
  // Credit note-specific
  applied: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800",
} as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  partially_paid: "Partial",
  overdue: "Overdue",
  sent: "Sent",
  accepted: "Accepted",
  converted: "Converted",
  expired: "Expired",
  applied: "Applied",
};

interface StatusBadgeProps {
  status: string;
  isIssued?: boolean;
  className?: string;
}

export const StatusBadge = ({ status, isIssued, className }: StatusBadgeProps) => {
  // For invoices, check if issued but status is still pending-like
  let effectiveStatus = status;
  if (isIssued && (status === "pending" || status === "draft")) {
    effectiveStatus = "issued";
  }

  const styleKey = effectiveStatus as keyof typeof STATUS_STYLES;
  const styles = STATUS_STYLES[styleKey] || STATUS_STYLES.draft;
  const label = STATUS_LABELS[effectiveStatus] || effectiveStatus.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Badge 
      variant="outline"
      className={cn(
        "text-[11px] px-2 py-0.5 font-medium border",
        styles,
        className
      )}
    >
      {label}
    </Badge>
  );
};

// Document type badge
const TYPE_STYLES = {
  invoice: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  credit_note: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  quotation: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
} as const;

const TYPE_LABELS = {
  invoice: "Invoice",
  credit_note: "Credit Note",
  quotation: "Quote",
};

interface TypeBadgeProps {
  type: "invoice" | "credit_note" | "quotation";
  className?: string;
}

export const TypeBadge = ({ type, className }: TypeBadgeProps) => {
  return (
    <Badge 
      variant="outline"
      className={cn(
        "text-[11px] px-2 py-0.5 font-medium border",
        TYPE_STYLES[type],
        className
      )}
    >
      {TYPE_LABELS[type]}
    </Badge>
  );
};
