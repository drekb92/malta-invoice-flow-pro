import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "./utils";

type RowType = "default" | "credit" | "payment" | "highlight";

interface TotalsRow {
  label: string;
  value: number;
  type?: RowType;
}

interface TransactionTotalsCardProps {
  rows: TotalsRow[];
  finalRow: {
    label: string;
    value: number | React.ReactNode;
    status?: "paid" | "due" | "credit" | "neutral";
  };
}

export const TransactionTotalsCard = ({ rows, finalRow }: TransactionTotalsCardProps) => {
  const getValueClass = (type?: TotalsRow["type"]) => {
    switch (type) {
      case "credit":
        return "text-destructive font-medium";
      case "payment":
        return "text-green-600 dark:text-green-400 font-medium";
      case "highlight":
        return "font-semibold text-foreground";
      default:
        return "text-foreground";
    }
  };

  const getFinalRowBgClass = (status?: "paid" | "due" | "credit" | "neutral") => {
    switch (status) {
      case "paid":
        return "bg-green-50/80 dark:bg-green-950/30";
      case "due":
        return "bg-red-50/80 dark:bg-red-950/30";
      case "credit":
        return "bg-amber-50/80 dark:bg-amber-950/30";
      default:
        return "bg-muted/40";
    }
  };

  const formatValue = (value: number, type?: TotalsRow["type"]) => {
    if (type === "credit" || type === "payment") {
      return `– ${formatCurrency(value)}`;
    }
    return formatCurrency(value);
  };

  return (
    <div className="bg-card border border-border/60 rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 space-y-2.5">
        {rows.map((row, idx) => (
          <div key={idx} className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className={`tabular-nums ${getValueClass(row.type)}`}>
              {formatValue(row.value, row.type)}
            </span>
          </div>
        ))}
      </div>
      
      <Separator />
      
      <div className={`px-4 py-3 flex justify-between items-center ${getFinalRowBgClass(finalRow.status)}`}>
        <span className="text-sm font-semibold text-foreground">{finalRow.label}</span>
        {typeof finalRow.value === "number" ? (
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(finalRow.value)}
          </span>
        ) : (
          finalRow.value
        )}
      </div>
    </div>
  );
};
