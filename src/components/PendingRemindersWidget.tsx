import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Settings,
  Loader2,
  Mail,
  MessageCircle,
  Clock,
  Calendar,
  Send,
} from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import { formatDistanceToNow } from "date-fns";

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  total_amount: number;
  due_date: string;
  days_overdue: number;
  last_sent_at?: string | null;
  last_sent_channel?: string | null;
  last_reminded_at?: string | null;
}

interface PendingRemindersWidgetProps {
  overdueInvoices: OverdueInvoice[];
  maxDisplay?: number;
  formatCurrency: (amount: number) => string;
  onReminderSent?: () => void;
}

type Channel = "email" | "whatsapp";

interface InvoiceChannelState {
  [invoiceId: string]: Channel;
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
  
  // Track selected channel per invoice
  const [channelState, setChannelState] = useState<InvoiceChannelState>(() => {
    const initial: InvoiceChannelState = {};
    overdueInvoices.forEach((inv) => {
      // Default to last used channel or email
      initial[inv.id] = (inv.last_sent_channel === "whatsapp" ? "whatsapp" : "email");
    });
    return initial;
  });

  // Sort by days overdue (most urgent first) and take top N
  const sortedInvoices = [...overdueInvoices].sort(
    (a, b) => b.days_overdue - a.days_overdue
  );
  const topInvoices = sortedInvoices.slice(0, maxDisplay);
  const remainingCount = overdueInvoices.length - maxDisplay;

  const handleSendNow = async (invoice: OverdueInvoice) => {
    setSendingInvoiceId(invoice.id);
    // Determine reminder level based on days overdue
    let level: "friendly" | "firm" | "final" = "friendly";
    if (invoice.days_overdue >= 21) {
      level = "final";
    } else if (invoice.days_overdue >= 14) {
      level = "firm";
    }
    
    const result = await sendReminder(invoice.id, level);
    setSendingInvoiceId(null);
    if (result.success && onReminderSent) {
      onReminderSent();
    }
  };

  const handleSchedule = (invoiceId: string, when: string) => {
    // For now, navigate to reminder settings with context
    // In a full implementation, this would create a scheduled reminder
    navigate(`/reminders?schedule=${when}&invoice=${invoiceId}`);
  };

  const toggleChannel = (invoiceId: string, channel: Channel) => {
    setChannelState((prev) => ({
      ...prev,
      [invoiceId]: channel,
    }));
  };

  const getOverdueBadgeVariant = (daysOverdue: number) => {
    if (daysOverdue >= 14) return "destructive";
    if (daysOverdue >= 7) return "secondary";
    return "outline";
  };

  const formatLastReminded = (lastRemindedAt: string | null | undefined) => {
    if (!lastRemindedAt) return "Never";
    try {
      return formatDistanceToNow(new Date(lastRemindedAt), { addSuffix: true });
    } catch {
      return "Unknown";
    }
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
            onClick={() => navigate("/reminders")}
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
                className="p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors space-y-3"
              >
                {/* Row 1: Invoice details */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="font-semibold text-sm hover:underline text-foreground"
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
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {invoice.customer_name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm">
                      {formatCurrency(invoice.total_amount)}
                    </div>
                  </div>
                </div>

                {/* Row 2: Last reminded */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Last reminded: {formatLastReminded(invoice.last_reminded_at)}</span>
                </div>

                {/* Row 3: Channel chips + Actions */}
                <div className="flex items-center justify-between gap-2">
                  {/* Channel selector chips */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleChannel(invoice.id, "email")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        channelState[invoice.id] === "email"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <Mail className="h-3 w-3" />
                      Email
                    </button>
                    <button
                      onClick={() => toggleChannel(invoice.id, "whatsapp")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        channelState[invoice.id] === "whatsapp"
                          ? "bg-green-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => handleSendNow(invoice)}
                      disabled={sending && sendingInvoiceId === invoice.id}
                    >
                      {sending && sendingInvoiceId === invoice.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-3 w-3 mr-1" />
                          Send now
                        </>
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={sending && sendingInvoiceId === invoice.id}
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => handleSchedule(invoice.id, "tomorrow")}
                        >
                          Tomorrow 9am
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSchedule(invoice.id, "next-week")}
                        >
                          Next week
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleSchedule(invoice.id, "custom")}
                        >
                          Custom...
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
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
