import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SendDocumentEmailDialog } from "@/components/SendDocumentEmailDialog";
import { useAuth } from "@/hooks/useAuth";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useReminders } from "@/hooks/useReminders";
import {
  Bell,
  CheckCircle2,
  Loader2,
  Send,
  ArrowRight,
} from "lucide-react";


interface OverdueInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  total_amount: number;
  balance_due: number;
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

  // Sort by days overdue (most urgent first) and take top 6
  const sortedOverdueInvoices = [...overdueInvoices].sort(
    (a, b) => b.days_overdue - a.days_overdue
  );
  const topOverdueInvoices = sortedOverdueInvoices.slice(0, 6);
  const remainingOverdueCount = overdueInvoices.length - 6;

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

  const getOverdueBadgeVariant = (daysOverdue: number) => {
    if (daysOverdue >= 14) return "destructive";
    if (daysOverdue >= 7) return "secondary";
    return "outline";
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
                <ArrowRight className="h-3 w-3" />
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
                <>
                  <div className="flex items-center gap-2 px-3 pb-1.5 mb-1 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span className="w-[100px] shrink-0">Invoice</span>
                    <span className="flex-1 min-w-0">Customer</span>
                    <span className="w-[90px] text-right shrink-0">Amount</span>
                    <span className="w-[80px] text-right shrink-0">Overdue</span>
                    <span className="w-[72px] text-right shrink-0">Action</span>
                  </div>
                  <div className="divide-y divide-border/60 pr-1">
                    {topOverdueInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center gap-2 py-1.5 px-3 hover:bg-muted/50 transition-colors"
                      >
                        <Link
                          to={`/invoices/${invoice.id}`}
                          className="w-[100px] shrink-0 font-medium text-sm hover:text-primary transition-colors truncate"
                        >
                          {invoice.invoice_number}
                        </Link>
                        <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                          {invoice.customer_name}
                        </span>
                        <span className="w-[90px] text-right text-sm font-medium tabular-nums shrink-0">
                          {invoice.balance_due > 0 ? (
                            formatCurrency(invoice.balance_due)
                          ) : invoice.total_amount > 0 ? (
                            formatCurrency(0)
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground cursor-help">—</span>
                                </TooltipTrigger>
                                <TooltipContent>Amount not available</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </span>
                        <div className="w-[80px] flex justify-end shrink-0">
                          <Badge
                            variant={getOverdueBadgeVariant(invoice.days_overdue)}
                            className="text-xs h-5 px-1.5"
                          >
                            {invoice.days_overdue}d
                          </Badge>
                        </div>
                        <div className="w-[72px] flex justify-end shrink-0">
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
                                <Bell className="h-3 w-3 mr-1" />
                                Remind
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {remainingOverdueCount > 0 && (
                    <div className="text-center pt-2 border-t mt-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate("/invoices?status=overdue")}
                      >
                        {remainingOverdueCount} more need attention →
                      </Button>
                    </div>
                  )}
                </>
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
                <>
                  <div className="flex items-center gap-2 px-3 pb-1.5 mb-1 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span className="w-[100px] shrink-0">Invoice</span>
                    <span className="flex-1 min-w-0">Customer</span>
                    <span className="w-[90px] text-right shrink-0">Amount</span>
                    <span className="w-[80px] text-right shrink-0">Status</span>
                    <span className="w-[72px] text-right shrink-0">Action</span>
                  </div>
                  <div className="divide-y divide-border/60 pr-1">
                    {needsSendingInvoices.slice(0, 6).map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center gap-2 py-1.5 px-3 hover:bg-muted/50 transition-colors"
                      >
                        <button
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                          className="w-[100px] shrink-0 font-medium text-sm hover:text-primary transition-colors truncate text-left"
                        >
                          {invoice.invoice_number}
                        </button>
                        <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                          {invoice.customer_name}
                        </span>
                        <span className="w-[90px] text-right text-sm font-medium tabular-nums shrink-0">
                          {formatCurrency(invoice.total_amount)}
                        </span>
                        <div className="w-[80px] flex justify-end shrink-0">
                          <Badge
                            variant={invoice.status === "draft" ? "secondary" : "outline"}
                            className="text-xs h-5 px-1.5"
                          >
                            {invoice.status === "draft" ? "Draft" : "Not sent"}
                          </Badge>
                        </div>
                        <div className="w-[72px] flex justify-end shrink-0">
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={() => handleSendClick(invoice)}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {needsSendingInvoices.length > 6 && (
                    <div className="text-center pt-2 border-t mt-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate("/invoices?needsSending=true")}
                      >
                        {needsSendingInvoices.length - 6} more to send →
                      </Button>
                    </div>
                  )}
                </>
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
          previewAvailable={false}
        />
      )}
    </>
  );
}
