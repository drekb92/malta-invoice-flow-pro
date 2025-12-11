import { format } from "date-fns";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, CheckCircle, Clock, CreditCard, AlertCircle, Loader2, Receipt, Banknote, ExternalLink, Download } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  is_issued: boolean;
}

interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  amount: number;
  reason: string;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  method: string | null;
}

interface TimelineEvent {
  id: string;
  type: "invoice" | "credit_note" | "payment";
  date: string;
  title: string;
  subtitle?: string;
  amount?: number;
}

interface InvoiceSettlementSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, { className: string; icon: React.ElementType; label: string }> = {
    paid: {
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      icon: CheckCircle,
      label: "Paid",
    },
    pending: {
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      icon: Clock,
      label: "Pending",
    },
    partially_paid: {
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      icon: CreditCard,
      label: "Partially Paid",
    },
    issued: {
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      icon: FileText,
      label: "Issued",
    },
    overdue: {
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      icon: AlertCircle,
      label: "Overdue",
    },
    draft: {
      className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      icon: FileText,
      label: "Draft",
    },
  };
  return variants[status] || variants.draft;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export const InvoiceSettlementSheet = ({
  open,
  onOpenChange,
  invoice,
}: InvoiceSettlementSheetProps) => {
  const navigate = useNavigate();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const handleViewInvoice = () => {
    if (invoice) {
      onOpenChange(false);
      navigate(`/invoices/${invoice.id}`);
    }
  };

  useEffect(() => {
    if (open && invoice) {
      loadSettlementData();
    }
  }, [open, invoice?.id]);

  const loadSettlementData = async () => {
    if (!invoice) return;
    
    setLoading(true);
    try {
      const [creditNotesResult, paymentsResult] = await Promise.all([
        supabase
          .from("credit_notes")
          .select("id, credit_note_number, credit_note_date, amount, reason")
          .eq("original_invoice_id", invoice.id)
          .order("credit_note_date", { ascending: false }),
        supabase
          .from("payments")
          .select("id, payment_date, amount, method")
          .eq("invoice_id", invoice.id)
          .order("payment_date", { ascending: false }),
      ]);

      if (creditNotesResult.data) {
        setCreditNotes(creditNotesResult.data);
      }
      if (paymentsResult.data) {
        setPayments(paymentsResult.data);
      }
    } catch (error) {
      console.error("Error loading settlement data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Build timeline events
  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    if (!invoice) return [];

    const events: TimelineEvent[] = [
      {
        id: `invoice-${invoice.id}`,
        type: "invoice",
        date: invoice.invoice_date,
        title: "Invoice Issued",
        subtitle: invoice.invoice_number,
        amount: invoice.total_amount,
      },
    ];

    creditNotes.forEach((cn) => {
      events.push({
        id: `cn-${cn.id}`,
        type: "credit_note",
        date: cn.credit_note_date,
        title: cn.credit_note_number,
        subtitle: cn.reason,
        amount: Number(cn.amount),
      });
    });

    payments.forEach((p) => {
      events.push({
        id: `payment-${p.id}`,
        type: "payment",
        date: p.payment_date,
        title: "Payment Received",
        subtitle: p.method ? p.method.charAt(0).toUpperCase() + p.method.slice(1) : undefined,
        amount: Number(p.amount),
      });
    });

    // Sort by date ascending
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return events;
  }, [invoice, creditNotes, payments]);

  if (!invoice) return null;

  const statusBadge = getStatusBadge(invoice.status);
  const StatusIcon = statusBadge.icon;

  const totalCredits = creditNotes.reduce((sum, cn) => sum + Number(cn.amount), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingBalance = invoice.total_amount - totalCredits - totalPayments;

  const getBalanceDisplay = () => {
    if (remainingBalance === 0) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-200">
          Paid in full
        </Badge>
      );
    } else if (remainingBalance < 0) {
      return (
        <div className="text-right">
          <span className="text-lg font-bold text-green-600">
            {formatCurrency(Math.abs(remainingBalance))}
          </span>
          <div className="text-xs text-green-600">Credit in favour</div>
        </div>
      );
    } else {
      return (
        <span className="text-lg font-bold text-destructive">
          {formatCurrency(remainingBalance)}
        </span>
      );
    }
  };

  const getTimelineIcon = (type: "invoice" | "credit_note" | "payment") => {
    switch (type) {
      case "invoice":
        return <FileText className="h-3.5 w-3.5" />;
      case "credit_note":
        return <Receipt className="h-3.5 w-3.5" />;
      case "payment":
        return <Banknote className="h-3.5 w-3.5" />;
    }
  };

  const getTimelineColor = (type: "invoice" | "credit_note" | "payment") => {
    switch (type) {
      case "invoice":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300";
      case "credit_note":
        return "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300";
      case "payment":
        return "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[400px] p-0 overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg font-semibold">
                Invoice {invoice.invoice_number}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground flex-wrap">
                <Badge className={`${statusBadge.className} text-xs`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusBadge.label}
                </Badge>
                <span>·</span>
                <span>{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</span>
                <span>·</span>
                <span>Due {format(new Date(invoice.due_date), "dd MMM yyyy")}</span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading settlement details…</span>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100%-73px)]">
            <div className="flex-1 px-6 py-4 space-y-6 overflow-y-auto">
            {/* (A) Summary Section */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Original Amount
                </div>
                <div className="text-lg font-semibold">
                  {formatCurrency(invoice.total_amount)}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Remaining Balance
                </div>
                {getBalanceDisplay()}
              </div>
            </div>

            {/* (B) Settlement Breakdown */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Settlement Breakdown
              </h3>

              {/* Credit Notes Applied */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Credit Notes Applied</h4>
                {creditNotes.length > 0 ? (
                  <div className="space-y-2">
                    {creditNotes.map((cn) => (
                      <div
                        key={cn.id}
                        className="flex justify-between items-start p-3 bg-muted/30 rounded-lg border border-border/50"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {cn.credit_note_number} · {format(new Date(cn.credit_note_date), "dd MMM yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {cn.reason}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-destructive">
                          – {formatCurrency(Number(cn.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No credit notes applied to this invoice.
                  </p>
                )}
              </div>

              <Separator />

              {/* Payments Received */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Payments Received</h4>
                {payments.length > 0 ? (
                  <div className="space-y-2">
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex justify-between items-start p-3 bg-muted/30 rounded-lg border border-border/50"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {format(new Date(p.payment_date!), "dd MMM yyyy")}
                            {p.method && (
                              <span className="text-muted-foreground"> · {p.method.charAt(0).toUpperCase() + p.method.slice(1)}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(Number(p.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No payments recorded yet.
                  </p>
                )}
              </div>

              {/* Summary Line */}
              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pt-2">
                <span>Credit Notes: <span className="font-medium text-destructive">– {formatCurrency(totalCredits)}</span></span>
                <span>·</span>
                <span>Payments: <span className="font-medium text-green-600">{formatCurrency(totalPayments)}</span></span>
              </div>
            </div>

            {/* (C) Activity Timeline */}
            {timelineEvents.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Activity Timeline
                </h3>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />
                  
                  <div className="space-y-3">
                    {timelineEvents.map((event, index) => (
                      <div key={event.id} className="flex items-start gap-3 relative">
                        {/* Icon */}
                        <div className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full ${getTimelineColor(event.type)}`}>
                          {getTimelineIcon(event.type)}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium truncate">{event.title}</div>
                            {event.amount && event.type !== "invoice" && (
                              <span className={`text-xs font-medium ${event.type === "credit_note" ? "text-destructive" : "text-green-600"}`}>
                                {event.type === "credit_note" ? "–" : "+"} {formatCurrency(event.amount)}
                              </span>
                            )}
                            {event.type === "invoice" && event.amount && (
                              <span className="text-xs font-medium">
                                {formatCurrency(event.amount)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{format(new Date(event.date), "dd MMM yyyy")}</span>
                            {event.subtitle && (
                              <>
                                <span>·</span>
                                <span className="truncate">{event.subtitle}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* (D) Action Buttons */}
            <div className="px-6 py-4 border-t border-border bg-background">
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto order-2 sm:order-1"
                  onClick={() => {
                    // Placeholder for download statement functionality
                    console.log("Download statement for invoice:", invoice?.id);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Statement
                </Button>
                <Button
                  className="w-full sm:w-auto order-1 sm:order-2"
                  onClick={handleViewInvoice}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Invoice
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
