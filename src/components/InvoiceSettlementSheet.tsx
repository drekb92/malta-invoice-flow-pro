import { format } from "date-fns";
import { useEffect, useState, useMemo, useCallback } from "react";
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
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
import type { InvoiceData } from "@/services/pdfService";

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
  const [customer, setCustomer] = useState<{ id: string; name: string; email: string | null; address: string | null; address_line1: string | null; address_line2: string | null; locality: string | null; post_code: string | null; vat_number: string | null } | null>(null);
  const [invoiceCreatedAt, setInvoiceCreatedAt] = useState<string | null>(null);
  const [invoiceIssuedAt, setInvoiceIssuedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [pdfInvoiceData, setPdfInvoiceData] = useState<InvoiceData | null>(null);

  // Load template, company, and banking settings for PDF generation
  const { template } = useInvoiceTemplate();
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();

  const handleViewInvoice = () => {
    if (invoice) {
      onOpenChange(false);
      navigate(`/invoices/${invoice.id}`);
    }
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!invoice || !customer || invoiceItems.length === 0) {
      toast({
        title: "Cannot generate PDF",
        description: "Missing invoice data. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!companySettings?.company_name) {
      toast({
        title: "Company Settings Required",
        description: "Please complete your company information in Settings before downloading PDFs.",
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
          address_line1: customer.address_line1 || undefined,
          address_line2: customer.address_line2 || undefined,
          locality: customer.locality || undefined,
          post_code: customer.post_code || undefined,
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

      // Set PDF data to trigger hidden container render
      setPdfInvoiceData(invoiceData);

      // Wait for next frame to ensure DOM is updated
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 100));

      const filename = `Invoice-${invoice.invoice_number}`;
      await downloadPdfFromFunction(filename, template?.font_family);

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
      setPdfInvoiceData(null);
    }
  }, [invoice, customer, invoiceItems, companySettings, template, toast]);

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
          .eq("invoice_id", invoice.id)
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
          .select("created_at, issued_at, customer_id, customers(id, name, email, address, address_line1, address_line2, locality, post_code, vat_number)")
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
        const invoiceData = invoiceDetailsResult.data as { 
          customers: { 
            id: string; 
            name: string; 
            email: string | null; 
            address: string | null; 
            address_line1: string | null; 
            address_line2: string | null; 
            locality: string | null; 
            post_code: string | null; 
            vat_number: string | null; 
          } | null 
        };
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
        title: `Payment${p.method ? ` (${p.method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())})` : ""}`,
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
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[420px] p-0 flex flex-col">
          {/* Fixed Header */}
          <SheetHeader className="px-5 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base" style={{ fontWeight: 600 }}>
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
                <div className="mt-3">
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
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Balance Due</span>
                      {getBalanceDisplay()}
                    </div>
                  </div>
                </div>

                {/* 3. Settlement Breakdown */}
                {(creditNotes.length > 0 || payments.length > 0) && (
                  <div className="mt-3">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Settlement Breakdown
                    </h3>
                    <div className="space-y-2">
                      {creditNotes.length > 0 && (
                        <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-2.5 border border-amber-100 dark:border-amber-900/30">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Receipt className="h-3.5 w-3.5 text-amber-600" />
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Credit Notes Applied</span>
                          </div>
                          {creditNotes.map((cn) => (
                            <div key={cn.id} className="flex justify-between text-xs py-0.5">
                              <span className="text-muted-foreground">{cn.credit_note_number}</span>
                              <span className="font-medium text-amber-700 dark:text-amber-400">
                                – {formatCurrency(getCreditNoteGrossAmount(cn))}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs pt-1 border-t border-amber-200/50 dark:border-amber-800/30 mt-1">
                            <span className="font-medium">Total Credits</span>
                            <span className="font-medium text-amber-700 dark:text-amber-400">
                              – {formatCurrency(totalCredits)}
                            </span>
                          </div>
                        </div>
                      )}

                      {payments.length > 0 && (
                        <div className="bg-green-50/50 dark:bg-green-950/20 rounded-lg p-2.5 border border-green-100 dark:border-green-900/30">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Banknote className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs font-medium text-green-700 dark:text-green-400">Payments Received</span>
                          </div>
                          {payments.map((p) => (
                            <div key={p.id} className="flex justify-between text-xs py-0.5">
                              <span className="text-muted-foreground">
                                {format(new Date(p.payment_date), "dd MMM yyyy")}
                                {p.method && <span className="text-[10px] ml-1">({p.method.replace(/_/g, " ")})</span>}
                              </span>
                              <span className="font-medium text-green-700 dark:text-green-400">
                                – {formatCurrency(Number(p.amount))}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs pt-1 border-t border-green-200/50 dark:border-green-800/30 mt-1">
                            <span className="font-medium">Total Paid</span>
                            <span className="font-medium text-green-700 dark:text-green-400">
                              – {formatCurrency(totalPayments)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Activity Timeline (Collapsible) */}
                {timelineEvents.length > 0 && (
                  <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen} className="mt-3">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide py-1.5 hover:text-foreground transition-colors">
                        <span>Activity Timeline</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${timelineOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <div className="relative pl-4">
                        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                        <div className="space-y-2.5">
                          {timelineEvents.map((event) => (
                            <div key={event.id} className="flex items-start gap-2.5 relative">
                              <div className={`flex items-center justify-center w-5 h-5 rounded-full ${getTimelineColor(event.type)} -ml-4 z-10`}>
                                {getTimelineIcon(event.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-medium truncate">{event.title}</span>
                                  {event.amount !== undefined && (
                                    <span className={`text-xs font-medium ${event.type === "credit_note" ? "text-amber-600" : "text-green-600"}`}>
                                      – {formatCurrency(event.amount)}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(event.date), "dd MMM yyyy")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>

              {/* Fixed Footer with Actions */}
              <div className="shrink-0 border-t border-border bg-background px-5 py-3 space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                  >
                    {downloadingPdf ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Download PDF
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
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

      {/* Hidden PDF preview for Edge HTML engine */}
      {pdfInvoiceData && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <UnifiedInvoiceLayout
            id="invoice-preview-root"
            variant="pdf"
            invoiceData={pdfInvoiceData}
            documentType="INVOICE"
            companySettings={companySettings ? {
              name: companySettings.company_name,
              email: companySettings.company_email,
              phone: companySettings.company_phone,
              address: companySettings.company_address,
              city: companySettings.company_city,
              state: companySettings.company_state,
              zipCode: companySettings.company_zip_code,
              country: companySettings.company_country,
              taxId: companySettings.company_vat_number,
              registrationNumber: companySettings.company_registration_number,
              logo: companySettings.company_logo,
            } : undefined}
            bankingSettings={bankingSettings ? {
              bankName: bankingSettings.bank_name,
              accountName: bankingSettings.bank_account_name,
              swiftCode: bankingSettings.bank_swift_code,
              iban: bankingSettings.bank_iban,
            } : undefined}
            templateSettings={template ? {
              primaryColor: template.primary_color,
              accentColor: template.accent_color,
              fontFamily: template.font_family,
              fontSize: template.font_size,
              layout: template.layout as any,
              headerLayout: template.header_layout as any,
              tableStyle: template.table_style as any,
              totalsStyle: template.totals_style as any,
              bankingVisibility: template.banking_visibility,
              bankingStyle: template.banking_style as any,
              marginTop: template.margin_top,
              marginRight: template.margin_right,
              marginBottom: template.margin_bottom,
              marginLeft: template.margin_left,
            } : undefined}
          />
        </div>
      )}
    </>
  );
};
