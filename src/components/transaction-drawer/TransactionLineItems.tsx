import type { LineItem } from "./types";
import { formatCurrency } from "./utils";

interface TransactionLineItemsProps {
  items: LineItem[];
}

export const TransactionLineItems = ({ items }: TransactionLineItemsProps) => {
  if (items.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Line Items
      </h3>
      <div className="border border-border/60 rounded-lg overflow-hidden bg-card/50">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border/40">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
              <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground w-10">Qty</th>
              <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground w-16">Price</th>
              <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground w-12">VAT</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-18">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const lineTotal = item.quantity * item.unit_price * (1 + item.vat_rate);
              return (
                <tr key={item.id} className={idx !== items.length - 1 ? "border-b border-border/30" : ""}>
                  <td className="px-3 py-2.5 text-sm text-foreground">
                    <span 
                      className="block line-clamp-2" 
                      title={item.description}
                    >
                      {item.description}
                    </span>
                  </td>
                  <td className="text-right px-2 py-2.5 text-sm text-muted-foreground tabular-nums">{item.quantity}</td>
                  <td className="text-right px-2 py-2.5 text-sm text-muted-foreground tabular-nums">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right px-2 py-2.5 text-sm text-muted-foreground tabular-nums">{(item.vat_rate * 100).toFixed(0)}%</td>
                  <td className="text-right px-3 py-2.5 text-sm font-semibold text-foreground tabular-nums">{formatCurrency(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};