import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCircle2, ChevronDown, Settings, Loader2 } from "lucide-react";
import { useReminders } from "@/hooks/useReminders";

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  total_amount: number;
  due_date: string;
  days_overdue: number;
}

interface PendingRemindersWidgetProps {
  overdueInvoices: OverdueInvoice[];
  maxDisplay?: number;
  formatCurrency: (amount: number) => string;
  onReminderSent?: () => void;
}

export function PendingRemindersWidget({
  overdueInvoices,
  maxDisplay = 3,
  formatCurrency,
  onReminderSent,
}: PendingRemindersWidgetProps) {
  const navigate = useNavigate();
  const { sendReminder, sending } = useReminders();
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  // Sort by days overdue (most urgent first) and take top N
  const sortedInvoices = [...overdueInvoices].sort(
    (a, b) => b.days_overdue - a.days_overdue
  );
  const topInvoices = sortedInvoices.slice(0, maxDisplay);
  const remainingCount = overdueInvoices.length - maxDisplay;

  const handleSendReminder = async (
    invoiceId: string,
    level: "friendly" | "firm" | "final"
  ) => {
    setSendingInvoiceId(invoiceId);
    const result = await sendReminder(invoiceId, level);
    setSendingInvoiceId(null);
    if (result.success && onReminderSent) {
      onReminderSent();
    }
  };

  const getOverdueBadgeVariant = (daysOverdue: number) => {
    if (daysOverdue >= 14) return "destructive";
    if (daysOverdue >= 7) return "secondary";
    return "outline";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Pending Reminders
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate("/reminder-settings")}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {overdueInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary mb-2" />
            <p className="text-sm font-medium text-foreground">
              All invoices are on track!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              No overdue invoices need attention
            </p>
          </div>
        ) : (
          <>
            {topInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/invoices/${invoice.id}`}
                      className="font-medium text-sm hover:underline text-foreground"
                    >
                      {invoice.invoice_number}
                    </Link>
                    <Badge
                      variant={getOverdueBadgeVariant(invoice.days_overdue)}
                      className="text-xs"
                    >
                      {invoice.days_overdue}d overdue
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground truncate">
                      {invoice.customer_name}
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {formatCurrency(invoice.total_amount)}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 shrink-0"
                      disabled={sending && sendingInvoiceId === invoice.id}
                    >
                      {sending && sendingInvoiceId === invoice.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          Send
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleSendReminder(invoice.id, "friendly")}
                    >
                      Friendly Reminder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleSendReminder(invoice.id, "firm")}
                    >
                      Firm Reminder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleSendReminder(invoice.id, "final")}
                    >
                      Final Notice
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {remainingCount > 0 && (
              <div className="text-center pt-2">
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs"
                  onClick={() => navigate("/invoices?status=overdue")}
                >
                  {remainingCount} more invoice{remainingCount !== 1 ? "s" : ""}{" "}
                  need attention →
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
