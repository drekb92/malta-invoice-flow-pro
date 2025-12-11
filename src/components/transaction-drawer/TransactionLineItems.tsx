import { FileText } from "lucide-react";
import type { LineItem } from "./types";
import { formatCurrency } from "./utils";

interface TransactionLineItemsProps {
  items: LineItem[];
}

export const TransactionLineItems = ({ items }: TransactionLineItemsProps) => {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        <FileText className="h-3.5 w-3.5" />
        Line Items
      </h3>
      <div className="border border-border/60 rounded-lg overflow-hidden bg-card/50">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border/40">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
              <th className="text-right px-2 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-12">Qty</th>
              <th className="text-right px-2 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-20">Price</th>
              <th className="text-right px-2 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-14">VAT</th>
              <th className="text-right px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const lineTotal = item.quantity * item.unit_price * (1 + item.vat_rate);
              return (
                <tr key={item.id} className={idx !== items.length - 1 ? "border-b border-border/30" : ""}>
                  <td className="px-3 py-2.5 text-sm text-foreground truncate max-w-[120px]" title={item.description}>
                    {item.description}
                  </td>
                  <td className="text-right px-2 py-2.5 text-sm text-muted-foreground">{item.quantity}</td>
                  <td className="text-right px-2 py-2.5 text-sm text-muted-foreground">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right px-2 py-2.5 text-sm text-muted-foreground">{(item.vat_rate * 100).toFixed(0)}%</td>
                  <td className="text-right px-3 py-2.5 text-sm font-medium text-foreground">{formatCurrency(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
