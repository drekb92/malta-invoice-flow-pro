import { format } from "date-fns";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, CheckCircle, Clock, CreditCard, AlertCircle, Loader2, Receipt, Banknote, ExternalLink, Download, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateInvoicePDFWithTemplate } from "@/lib/pdfGenerator";
import { InvoiceData } from "@/services/pdfService";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  amount?: number;
  vat_amount?: number;
  is_issued: boolean;
  customer_id?: string;
}

interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  amount: number;
  vat_rate: number;
  reason: string;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  method: string | null;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string | null;
}

interface TimelineEvent {
  id: string;
  type: "invoice_created" | "invoice_issued" | "credit_note" | "payment" | "paid";
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

// Calculate gross amount for credit note (net + VAT)
const getCreditNoteGrossAmount = (cn: CreditNote): number => {
  return cn.amount * (1 + cn.vat_rate);
};

export const InvoiceSettlementSheet = ({
  open,
  onOpenChange,
  invoice,
}: InvoiceSettlementSheetProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [customer, setCustomer] = useState<{ id: string; name: string; email: string | null; address: string | null; vat_number: string | null } | null>(null);
  const [invoiceCreatedAt, setInvoiceCreatedAt] = useState<string | null>(null);
  const [invoiceIssuedAt, setInvoiceIssuedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const handleViewInvoice = () => {
    if (invoice) {
      onOpenChange(false);
      navigate(`/invoices/${invoice.id}`);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice || !customer || invoiceItems.length === 0) {
      toast({
        title: "Cannot generate PDF",
        description: "Missing invoice data. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setDownloadingPdf(true);
    try {
      const netTotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const vatTotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price * item.vat_rate), 0);
      const grandTotal = netTotal + vatTotal;

      const invoiceData: InvoiceData = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        documentType: "INVOICE",
        customer: {
          name: customer.name,
          email: customer.email || undefined,
          address: customer.address || undefined,
          vat_number: customer.vat_number || undefined,
        },
        items: invoiceItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          unit: item.unit || undefined,
        })),
        totals: {
          netTotal,
          vatTotal,
          grandTotal,
        },
      };

      const filename = `Invoice-${invoice.invoice_number}`;
      await generateInvoicePDFWithTemplate(invoiceData, filename);

      toast({
        title: "PDF downloaded",
        description: `Invoice ${invoice.invoice_number} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      toast({
        title: "Download failed",
        description: "Failed to generate the invoice PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
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
      const [creditNotesResult, paymentsResult, invoiceItemsResult, invoiceDetailsResult] = await Promise.all([
        supabase
          .from("credit_notes")
          .select("id, credit_note_number, credit_note_date, amount, vat_rate, reason")
          .eq("original_invoice_id", invoice.id)
          .order("credit_note_date", { ascending: true }),
        supabase
          .from("payments")
          .select("id, payment_date, amount, method")
          .eq("invoice_id", invoice.id)
          .order("payment_date", { ascending: true }),
        supabase
          .from("invoice_items")
          .select("id, description, quantity, unit_price, vat_rate, unit")
          .eq("invoice_id", invoice.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("invoices")
          .select("created_at, issued_at, customer_id, customers(id, name, email, address, vat_number)")
          .eq("id", invoice.id)
          .maybeSingle(),
      ]);

      if (creditNotesResult.data) {
        setCreditNotes(creditNotesResult.data.map(cn => ({
          ...cn,
          amount: Number(cn.amount),
          vat_rate: Number(cn.vat_rate ?? 0),
        })));
      }
      if (paymentsResult.data) {
        setPayments(paymentsResult.data);
      }
      if (invoiceItemsResult.data) {
        setInvoiceItems(invoiceItemsResult.data.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          vat_rate: Number(item.vat_rate),
        })));
      }
      
      if (invoiceDetailsResult.data) {
        setInvoiceCreatedAt(invoiceDetailsResult.data.created_at);
        setInvoiceIssuedAt(invoiceDetailsResult.data.issued_at);
        const invoiceData = invoiceDetailsResult.data as { customers: { id: string; name: string; email: string | null; address: string | null; vat_number: string | null } | null };
        if (invoiceData.customers) {
          setCustomer(invoiceData.customers);
        }
      }
    } catch (error) {
      console.error("Error loading settlement data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals - use gross amounts for credit notes
  const totalCredits = creditNotes.reduce((sum, cn) => sum + getCreditNoteGrossAmount(cn), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingBalance = invoice ? invoice.total_amount - totalCredits - totalPayments : 0;

  // Build timeline events
  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    if (!invoice) return [];

    const events: TimelineEvent[] = [];

    if (invoiceCreatedAt) {
      events.push({
        id: `invoice-created-${invoice.id}`,
        type: "invoice_created",
        date: invoiceCreatedAt,
        title: "Invoice created",
      });
    }

    if (invoice.is_issued && invoiceIssuedAt) {
      events.push({
        id: `invoice-issued-${invoice.id}`,
        type: "invoice_issued",
        date: invoiceIssuedAt,
        title: "Invoice issued",
      });
    } else if (invoice.is_issued) {
      events.push({
        id: `invoice-issued-${invoice.id}`,
        type: "invoice_issued",
        date: invoice.invoice_date,
        title: "Invoice issued",
      });
    }

    creditNotes.forEach((cn) => {
      events.push({
        id: `cn-${cn.id}`,
        type: "credit_note",
        date: cn.credit_note_date,
        title: `Credit Note ${cn.credit_note_number}`,
        amount: getCreditNoteGrossAmount(cn),
      });
    });

    payments.forEach((p) => {
      events.push({
        id: `payment-${p.id}`,
        type: "payment",
        date: p.payment_date,
        title: `Payment${p.method ? ` (${p.method.charAt(0).toUpperCase() + p.method.slice(1)})` : ""}`,
        amount: Number(p.amount),
      });
    });

    const calcBalance = invoice.total_amount - totalCredits - totalPayments;
    if (calcBalance === 0 && payments.length > 0) {
      const lastPayment = [...payments].sort((a, b) => 
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      )[0];
      events.push({
        id: `paid-${invoice.id}`,
        type: "paid",
        date: lastPayment.payment_date,
        title: "Marked as paid",
      });
    }

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return events;
  }, [invoice, creditNotes, payments, invoiceCreatedAt, invoiceIssuedAt, totalCredits, totalPayments]);

  if (!invoice) return null;

  const statusBadge = getStatusBadge(invoice.status);
  const StatusIcon = statusBadge.icon;

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
          <span className="text-base font-semibold text-green-600">
            {formatCurrency(Math.abs(remainingBalance))}
          </span>
          <div className="text-[10px] text-green-600">Credit in favour</div>
        </div>
      );
    } else {
      return (
        <span className="text-base font-semibold text-destructive">
          {formatCurrency(remainingBalance)}
        </span>
      );
    }
  };

  const getTimelineIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "invoice_created":
      case "invoice_issued":
        return <FileText className="h-3 w-3" />;
      case "credit_note":
        return <Receipt className="h-3 w-3" />;
      case "payment":
        return <Banknote className="h-3 w-3" />;
      case "paid":
        return <CheckCircle className="h-3 w-3" />;
    }
  };

  const getTimelineColor = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "invoice_created":
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
      case "invoice_issued":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300";
      case "credit_note":
        return "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300";
      case "payment":
      case "paid":
        return "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[420px] p-0 flex flex-col">
        {/* Fixed Header */}
        <SheetHeader className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base font-semibold">
              {invoice.invoice_number}
            </SheetTitle>
            <Badge className={`${statusBadge.className} text-[10px] px-1.5 py-0.5`}>
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
              {statusBadge.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{customer?.name || "Loading..."}</p>
        </SheetHeader>

        <Separator />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : (
          <>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 1. Line Items (TOP) */}
              {invoiceItems.length > 0 && (
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
                        {invoiceItems.map((item, idx) => {
                          const lineTotal = item.quantity * item.unit_price * (1 + item.vat_rate);
                          return (
                            <tr key={item.id} className={idx !== invoiceItems.length - 1 ? "border-b border-border/50" : ""}>
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
              )}

              {/* 2. Invoice Financial Summary */}
              <div className="mt-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Invoice Summary
                </h3>
                <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Original Amount</span>
                    <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                  {totalCredits > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Credit Notes</span>
                      <span className="text-destructive">– {formatCurrency(totalCredits)}</span>
                    </div>
                  )}
                  {totalPayments > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payments</span>
                      <span className="text-green-600">– {formatCurrency(totalPayments)}</span>
                    </div>
                  )}
                  <Separator className="my-1.5" />
                  <div className={`flex justify-between items-center -mx-3 px-3 py-1.5 rounded-md ${
                    remainingBalance === 0 
                      ? "bg-green-50 dark:bg-green-950/30" 
                      : remainingBalance > 0 
                        ? "bg-red-50 dark:bg-red-950/30" 
                        : "bg-green-50 dark:bg-green-950/30"
                  }`}>
                    <span className="text-sm font-medium">Remaining Balance</span>
                    {getBalanceDisplay()}
                  </div>
                </div>
              </div>

              {/* 3. Settlement Breakdown */}
              {(creditNotes.length > 0 || payments.length > 0) && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Settlement Breakdown
                  </h3>
                  <div className="space-y-3">
                    {/* Credit Notes */}
                    {creditNotes.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-medium text-muted-foreground">Credit Notes Applied</h4>
                        <div className="space-y-1.5">
                          {creditNotes.map((cn) => (
                            <div
                              key={cn.id}
                              className="flex justify-between items-center py-2 px-2.5 bg-muted/30 rounded-md text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-medium">{cn.credit_note_number}</span>
                                <span className="text-muted-foreground"> · {format(new Date(cn.credit_note_date), "dd MMM")}</span>
                              </div>
                              <span className="font-medium text-destructive shrink-0 ml-2">
                                – {formatCurrency(getCreditNoteGrossAmount(cn))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payments */}
                    {payments.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-medium text-muted-foreground">Payments Received</h4>
                        <div className="space-y-1.5">
                          {payments.map((p) => (
                            <div
                              key={p.id}
                              className="flex justify-between items-center py-2 px-2.5 bg-muted/30 rounded-md text-xs"
                            >
                              <div className="min-w-0">
                                <span>{format(new Date(p.payment_date!), "dd MMM yyyy")}</span>
                                {p.method && (
                                  <span className="text-muted-foreground"> · {p.method.charAt(0).toUpperCase() + p.method.slice(1)}</span>
                                )}
                              </div>
                              <span className="font-medium text-green-600 shrink-0 ml-2">
                                {formatCurrency(Number(p.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Activity Timeline (Collapsible) */}
              {timelineEvents.length > 0 && (
                <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full group">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Activity Timeline
                    </h3>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${timelineOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="relative">
                      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                      <div className="space-y-2">
                        {timelineEvents.map((event) => (
                          <div key={event.id} className="flex items-start gap-2.5 relative">
                            <div className={`relative z-10 flex items-center justify-center w-5 h-5 rounded-full ${getTimelineColor(event.type)}`}>
                              {getTimelineIcon(event.type)}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs truncate">{event.title}</span>
                                {event.amount && (
                                  <span className={`text-[10px] font-medium ${event.type === "credit_note" ? "text-destructive" : "text-green-600"}`}>
                                    {event.type === "credit_note" ? "–" : ""}{formatCurrency(event.amount)}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {format(new Date(event.date), "dd/MM/yyyy HH:mm")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            {/* Fixed Footer Actions */}
            <div className="shrink-0 px-5 py-3 border-t border-border bg-background">
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto order-2 sm:order-1"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf || invoiceItems.length === 0}
                >
                  {downloadingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {downloadingPdf ? "Generating..." : "Download PDF"}
                </Button>
                <Button
                  size="sm"
                  className="w-full sm:w-auto order-1 sm:order-2"
                  onClick={handleViewInvoice}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  View Full Invoice
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
