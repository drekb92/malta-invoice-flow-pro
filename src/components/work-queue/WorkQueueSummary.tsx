import { useMemo } from "react";
import { Clock, CalendarClock, Bell, AlertTriangle } from "lucide-react";

interface OverdueInvoice {
  id: string;
  balance_due: number;
  days_overdue: number;
  due_date: string;
}

interface WorkQueueSummaryProps {
  overdueInvoices: OverdueInvoice[];
  formatCurrency: (amount: number) => string;
}

export function WorkQueueSummary({ overdueInvoices, formatCurrency }: WorkQueueSummaryProps) {
  const stats = useMemo(() => {
    const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);
    const oldestOverdue = overdueInvoices.length > 0
      ? Math.max(...overdueInvoices.map((inv) => inv.days_overdue))
      : 0;

    const now = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);
    // "Due next 7 days" doesn't apply to overdue invoices — show 0 or derive from other data
    // For now we count invoices overdue ≤7 days as "due soon"
    const dueNext7 = overdueInvoices.filter((inv) => inv.days_overdue <= 7).length;
    const followUpsPending = overdueInvoices.length;

    return { overdueTotal, oldestOverdue, dueNext7, followUpsPending };
  }, [overdueInvoices]);

  const items = [
    {
      label: "Overdue total",
      value: formatCurrency(stats.overdueTotal),
      icon: AlertTriangle,
    },
    {
      label: "Oldest overdue",
      value: stats.oldestOverdue > 0 ? `${stats.oldestOverdue}d` : "—",
      icon: Clock,
    },
    {
      label: "Due ≤ 7 days",
      value: stats.dueNext7.toString(),
      icon: CalendarClock,
    },
    {
      label: "Follow-ups",
      value: stats.followUpsPending.toString(),
      icon: Bell,
    },
  ];

  return (
    <div className="flex flex-col justify-center h-full space-y-3 pl-4 border-l border-border/40">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        Summary
      </p>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2.5">
          <item.icon className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground leading-none">{item.label}</p>
            <p className="text-sm font-semibold text-foreground tabular-nums leading-snug mt-0.5">
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
