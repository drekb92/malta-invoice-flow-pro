import type { LineItem } from "./types";
import { formatCurrency } from "./utils";

interface TransactionLineItemsProps {
  items: LineItem[];
}

export const TransactionLineItems = ({ items }: TransactionLineItemsProps) => {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Line Items
      </h3>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Description</th>
              <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-10">Qty</th>
              <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-16">Price</th>
              <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-12">VAT</th>
              <th className="text-right px-2.5 py-1.5 font-medium text-muted-foreground w-18">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const lineTotal = item.quantity * item.unit_price * (1 + item.vat_rate);
              return (
                <tr key={item.id} className={idx !== items.length - 1 ? "border-b border-border/50" : ""}>
                  <td className="px-2.5 py-1.5 text-foreground truncate max-w-[100px]" title={item.description}>
                    {item.description}
                  </td>
                  <td className="text-right px-2 py-1.5 text-muted-foreground">{item.quantity}</td>
                  <td className="text-right px-2 py-1.5 text-muted-foreground">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right px-2 py-1.5 text-muted-foreground">{(item.vat_rate * 100).toFixed(0)}%</td>
                  <td className="text-right px-2.5 py-1.5 font-medium">{formatCurrency(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
