import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SendDocumentEmailDialog } from "@/components/SendDocumentEmailDialog";
import { useAuth } from "@/hooks/useAuth";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useReminders } from "@/hooks/useReminders";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Mail,
  MessageCircle,
  Clock,
  Calendar,
  Send,
  FileText,
  ExternalLink,
} from "lucide-react";
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

interface UnsentInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string | null;
  total_amount: number;
  status: string;
}

interface WorkQueueCardProps {
  overdueInvoices: OverdueInvoice[];
  needsSendingInvoices: UnsentInvoice[];
  formatCurrency: (amount: number) => string;
  onReminderSent?: () => void;
  onInvoiceSent?: () => void;
}

type Channel = "email" | "whatsapp";

interface InvoiceChannelState {
  [invoiceId: string]: Channel;
}

export function WorkQueueCard({
  overdueInvoices,
  needsSendingInvoices,
  formatCurrency,
  onReminderSent,
  onInvoiceSent,
}: WorkQueueCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings: companySettings } = useCompanySettings();
  const { sendReminder, sending } = useReminders();
  
  const [activeTab, setActiveTab] = useState("reminders");
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<UnsentInvoice | null>(null);
  
  // Track selected channel per invoice for reminders
  const [channelState, setChannelState] = useState<InvoiceChannelState>(() => {
    const initial: InvoiceChannelState = {};
    overdueInvoices.forEach((inv) => {
      initial[inv.id] = (inv.last_sent_channel === "whatsapp" ? "whatsapp" : "email");
    });
    return initial;
  });

  // Sort by days overdue (most urgent first) and take top 5
  const sortedOverdueInvoices = [...overdueInvoices].sort(
    (a, b) => b.days_overdue - a.days_overdue
  );
  const topOverdueInvoices = sortedOverdueInvoices.slice(0, 5);
  const remainingOverdueCount = overdueInvoices.length - 5;

  const handleSendReminder = async (invoice: OverdueInvoice) => {
    setSendingInvoiceId(invoice.id);
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

  // Needs Sending handlers
  const handleSendClick = (invoice: UnsentInvoice) => {
    setSelectedInvoice(invoice);
    setSendDialogOpen(true);
  };

  const handleSendSuccess = () => {
    setSendDialogOpen(false);
    setSelectedInvoice(null);
    onInvoiceSent?.();
  };

  const getViewAllLink = () => {
    return activeTab === "reminders" 
      ? "/invoices?status=overdue" 
      : "/invoices?needsSending=true";
  };

  return (
    <>
      <Card className="flex flex-col max-h-[360px]">
        <CardHeader className="pb-2 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="reminders" className="gap-2">
                  <Bell className="h-4 w-4" />
                  Follow-up Queue
                  {overdueInvoices.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {overdueInvoices.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sending" className="gap-2">
                  <Send className="h-4 w-4" />
                  Needs Sending
                  {needsSendingInvoices.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {needsSendingInvoices.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <Link
                to={getViewAllLink()}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
              >
                View all
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </Tabs>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            {/* Follow-up Queue Tab */}
            <TabsContent value="reminders" className="mt-0 flex-1 overflow-auto">
              {overdueInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-primary mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    All invoices are on track!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No overdue invoices need attention
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {topOverdueInvoices.map((invoice) => (
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
                            onClick={() => handleSendReminder(invoice)}
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

                  {remainingOverdueCount > 0 && (
                    <div className="text-center pt-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate("/invoices?status=overdue")}
                      >
                        {remainingOverdueCount} more invoice{remainingOverdueCount !== 1 ? "s" : ""}{" "}
                        need attention →
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Needs Sending Tab */}
            <TabsContent value="sending" className="mt-0 flex-1 overflow-auto">
              {needsSendingInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-primary mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    All invoices have been sent!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No drafts or unsent invoices
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {needsSendingInvoices.slice(0, 5).map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/invoices/${invoice.id}`)}
                            className="font-medium text-sm hover:text-primary transition-colors truncate"
                          >
                            {invoice.invoice_number}
                          </button>
                          <Badge
                            variant={invoice.status === "draft" ? "secondary" : "outline"}
                            className="text-xs shrink-0"
                          >
                            {invoice.status === "draft" ? "Draft" : "Not sent"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {invoice.customer_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium">
                          {formatCurrency(invoice.total_amount)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => handleSendClick(invoice)}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Send
                        </Button>
                      </div>
                    </div>
                  ))}

                  {needsSendingInvoices.length > 5 && (
                    <div className="text-center pt-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate("/invoices?needsSending=true")}
                      >
                        {needsSendingInvoices.length - 5} more invoice{needsSendingInvoices.length - 5 !== 1 ? "s" : ""}{" "}
                        to send →
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedInvoice && user && (
        <SendDocumentEmailDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          documentType="invoice"
          documentId={selectedInvoice.id}
          documentNumber={selectedInvoice.invoice_number}
          customer={{
            id: selectedInvoice.customer_id,
            name: selectedInvoice.customer_name,
            email: selectedInvoice.customer_email,
          }}
          companyName={companySettings?.company_name || ""}
          userId={user.id}
          onSuccess={handleSendSuccess}
        />
      )}
    </>
  );
}
