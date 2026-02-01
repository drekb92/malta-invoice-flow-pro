import { useState, useRef } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, Download, Eye, Mail, MessageCircle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { downloadPdfFromFunction, prepareHtmlForPdf } from "@/lib/edgePdf";
import { SendDocumentEmailDialog } from "@/components/SendDocumentEmailDialog";
import { 
  UnifiedStatementLayout, 
  convertLegacyStatementData,
  StatementData,
  StatementInvoice,
  StatementCreditNote,
  StatementPayment 
} from "@/components/UnifiedStatementLayout";

interface StatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    name: string;
    email: string | null;
    address?: string | null;
    vat_number?: string | null;
  };
}

export const StatementModal = ({ open, onOpenChange, customer }: StatementModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { settings: companySettings } = useCompanySettings();
  const { template } = useInvoiceTemplate();
  const statementContainerRef = useRef<HTMLDivElement>(null);
  
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 3)));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [statementType, setStatementType] = useState<"outstanding" | "activity">("outstanding");
  const [includeCreditNotes, setIncludeCreditNotes] = useState(true);
  const [includeVatBreakdown, setIncludeVatBreakdown] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [statementNumber, setStatementNumber] = useState("");

  const fetchStatementData = async (): Promise<StatementData | null> => {
    if (!user) return null;

    try {
      // Fetch invoices for this customer within date range
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, due_date, status, total_amount, amount, vat_amount")
        .eq("customer_id", customer.id)
        .eq("user_id", user.id)
        .gte("invoice_date", format(dateFrom, "yyyy-MM-dd"))
        .lte("invoice_date", format(dateTo, "yyyy-MM-dd"))
        .neq("status", "draft")
        .order("invoice_date", { ascending: true });

      if (invoicesError) throw invoicesError;

      const invoiceIds = (invoicesData || []).map((inv) => inv.id);

      // Fetch all payments for these invoices (regardless of statement type - needed for balance calc)
      let payments: StatementPayment[] = [];
      if (invoiceIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select("id, payment_date, amount, method, invoice_id")
          .in("invoice_id", invoiceIds)
          .eq("user_id", user.id)
          .order("payment_date", { ascending: true });

        if (paymentsError) throw paymentsError;

        payments = (paymentsData || []).map((pmt) => ({
          id: pmt.id,
          payment_date: pmt.payment_date || "",
          amount: Number(pmt.amount) || 0,
          method: pmt.method,
          invoice_id: pmt.invoice_id,
        }));
      }

      // Fetch credit notes if included
      let creditNotes: StatementCreditNote[] = [];
      if (includeCreditNotes) {
        const { data: cnData, error: cnError } = await supabase
          .from("credit_notes")
          .select("id, credit_note_number, credit_note_date, amount, vat_rate, reason, invoice_id")
          .eq("customer_id", customer.id)
          .eq("user_id", user.id)
          .gte("credit_note_date", format(dateFrom, "yyyy-MM-dd"))
          .lte("credit_note_date", format(dateTo, "yyyy-MM-dd"))
          .order("credit_note_date", { ascending: true });

        if (cnError) throw cnError;

        creditNotes = (cnData || []).map((cn) => ({
          id: cn.id,
          credit_note_number: cn.credit_note_number,
          credit_note_date: cn.credit_note_date || "",
          amount: Number(cn.amount) || 0,
          vat_rate: Number(cn.vat_rate) || 0,
          reason: cn.reason,
          invoice_id: cn.invoice_id,
        }));
      }

      // Calculate payments per invoice to filter out fully-paid invoices for outstanding statement
      const paymentsByInvoice = new Map<string, number>();
      payments.forEach((pmt) => {
        const current = paymentsByInvoice.get(pmt.invoice_id) || 0;
        paymentsByInvoice.set(pmt.invoice_id, current + pmt.amount);
      });

      // Calculate credits per invoice
      const creditsByInvoice = new Map<string, number>();
      creditNotes.forEach((cn) => {
        if (cn.invoice_id) {
          const totalAmount = cn.amount + cn.amount * cn.vat_rate;
          const current = creditsByInvoice.get(cn.invoice_id) || 0;
          creditsByInvoice.set(cn.invoice_id, current + totalAmount);
        }
      });

      // Build invoices list
      const invoices: StatementInvoice[] = (invoicesData || [])
        .map((inv) => {
          const paidAmount = paymentsByInvoice.get(inv.id) || 0;
          const creditsAmount = creditsByInvoice.get(inv.id) || 0;
          return {
            id: inv.id,
            invoice_number: inv.invoice_number || "",
            invoice_date: inv.invoice_date || "",
            due_date: inv.due_date || "",
            status: inv.status || "",
            total_amount: Number(inv.total_amount) || 0,
            amount: Number(inv.amount) || 0,
            vat_amount: Number(inv.vat_amount) || 0,
            paid_amount: paidAmount + creditsAmount,
          };
        })
        .filter((inv) => {
          // For outstanding only, filter to invoices with remaining balance
          if (statementType === "outstanding") {
            const remaining = inv.total_amount - (inv.paid_amount || 0);
            return remaining > 0.01; // Small threshold for floating point
          }
          return true;
        });

      const data: StatementData = {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          address: customer.address || null,
          vat_number: customer.vat_number || null,
        },
        invoices,
        creditNotes: statementType === "outstanding" ? [] : creditNotes, // Don't include credit notes in outstanding view
        payments: statementType === "outstanding" ? [] : payments, // Don't include payments in outstanding view (they're already factored into the remaining calc)
        company: {
          name: companySettings?.company_name || "Your Company",
          email: companySettings?.company_email,
          phone: companySettings?.company_phone,
          address: companySettings?.company_address,
          city: companySettings?.company_city,
          country: companySettings?.company_country,
          vat_number: companySettings?.company_vat_number,
          logo: companySettings?.company_logo,
        },
        options: {
          dateFrom,
          dateTo,
          statementType,
          includeCreditNotes,
          includeVatBreakdown,
        },
        generatedAt: new Date(),
      };

      return data;
    } catch (error) {
      console.error("Error fetching statement data:", error);
      throw error;
    }
  };

  // Generate PDF using Edge Function
  const generateEdgePdf = async (data: StatementData, filename: string) => {
    // Set data and wait for render
    setStatementData(data);
    setIsGeneratingPdf(true);
    
    // Wait for the layout to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await downloadPdfFromFunction(filename, template?.font_family || 'Inter');
    } finally {
      setIsGeneratingPdf(false);
      setStatementData(null);
    }
  };

  const handlePreviewPDF = async () => {
    setIsLoading(true);
    try {
      const data = await fetchStatementData();
      if (!data) {
        toast({
          title: "Error",
          description: "Failed to fetch statement data.",
          variant: "destructive",
        });
        return;
      }

      const dateRange = `${format(dateFrom, "yyyyMMdd")}-${format(dateTo, "yyyyMMdd")}`;
      const filename = `Statement-${customer.name.replace(/\s+/g, "_")}-${dateRange}`;
      await generateEdgePdf(data, filename);

      toast({
        title: "Download Complete",
        description: "Statement PDF has been downloaded.",
      });
    } catch (error) {
      console.error("Error generating statement:", error);
      toast({
        title: "Error",
        description: "Failed to generate statement PDF.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const data = await fetchStatementData();
      if (!data) {
        toast({
          title: "Error",
          description: "Failed to fetch statement data.",
          variant: "destructive",
        });
        return;
      }

      const dateRange = `${format(dateFrom, "yyyyMMdd")}-${format(dateTo, "yyyyMMdd")}`;
      const filename = `Statement-${customer.name.replace(/\s+/g, "_")}-${dateRange}`;
      await generateEdgePdf(data, filename);

      toast({
        title: "Download Complete",
        description: `Statement for ${customer.name} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error downloading statement:", error);
      toast({
        title: "Download Error",
        description: "Failed to generate statement PDF.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate statement number for sharing
  const generateStatementNumber = () => {
    const dateRange = `${format(dateFrom, "yyyyMMdd")}-${format(dateTo, "yyyyMMdd")}`;
    return `Statement-${customer.name.replace(/\s+/g, "_")}-${dateRange}`;
  };

  const handleSendEmail = async () => {
    if (!customer.email) {
      toast({
        title: "No email address",
        description: "This customer doesn't have an email address on file.",
        variant: "destructive",
      });
      return;
    }

    setEmailLoading(true);
    try {
      const data = await fetchStatementData();
      if (!data) {
        toast({
          title: "Error",
          description: "Failed to fetch statement data.",
          variant: "destructive",
        });
        return;
      }

      const stmtNumber = generateStatementNumber();
      setStatementNumber(stmtNumber);
      setStatementData(data);
      setIsGeneratingPdf(true);

      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 150));

      setShowEmailDialog(true);
    } catch (error) {
      console.error("Error preparing email:", error);
      toast({
        title: "Error",
        description: "Failed to prepare statement for email.",
        variant: "destructive",
      });
      setStatementData(null);
      setIsGeneratingPdf(false);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    setWhatsappLoading(true);
    try {
      const data = await fetchStatementData();
      if (!data) {
        toast({
          title: "Error",
          description: "Failed to fetch statement data.",
          variant: "destructive",
        });
        return;
      }

      const stmtNumber = generateStatementNumber();
      setStatementNumber(stmtNumber);
      setStatementData(data);
      setIsGeneratingPdf(true);

      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 150));

      // Prepare HTML for the Edge Function
      const html = await prepareHtmlForPdf(stmtNumber, template?.font_family || 'Inter');

      // Call Edge Function to create share link
      const { data: shareData, error: shareError } = await supabase.functions.invoke(
        "create-document-share-link",
        {
          body: {
            html,
            filename: stmtNumber,
            userId: user?.id,
            documentType: "statement",
            documentId: customer.id,
            documentNumber: stmtNumber,
            customerId: customer.id,
          },
        }
      );

      if (shareError) throw shareError;
      if (shareData?.error) throw new Error(shareData.error);

      const shareUrl = shareData?.url;
      if (!shareUrl) throw new Error("No share URL returned");

      // Calculate balance for message
      const totalInvoiced = data.invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const totalCredits = data.creditNotes.reduce((sum, cn) => sum + cn.amount + cn.amount * cn.vat_rate, 0);
      const totalPayments = data.payments.reduce((sum, pmt) => sum + pmt.amount, 0);
      const balance = totalInvoiced - totalCredits - totalPayments;

      const openInvoiceCount = data.invoices.filter((inv) => {
        const remaining = inv.total_amount - (inv.paid_amount || 0);
        return remaining > 0.01;
      }).length;

      let balanceLine = "";
      if (balance > 0) {
        balanceLine = `Balance Due: €${balance.toFixed(2)} (${openInvoiceCount} open invoice${openInvoiceCount !== 1 ? "s" : ""})`;
      } else if (balance < 0) {
        balanceLine = `Credit Balance: €${Math.abs(balance).toFixed(2)}\nThis is a credit balance in your favour.`;
      } else {
        balanceLine = "No balance due";
      }

      const message = encodeURIComponent(
        `Hi ${customer.name},\n\n` +
        `Here is your account statement for the period ${format(dateFrom, "dd/MM/yyyy")} to ${format(dateTo, "dd/MM/yyyy")}.\n\n` +
        `${balanceLine}\n\n` +
        `View/Download PDF: ${shareUrl}\n\n` +
        `Please contact us if you have any questions.\n\n` +
        `Best regards,\n${companySettings?.company_name || "Your Company"}`
      );

      const whatsappUrl = `https://wa.me/?text=${message}`;

      // Open via redirect page to avoid cross-origin blocking
      const waWindow = window.open(`/redirect?url=${encodeURIComponent(whatsappUrl)}`, "_blank");
      if (!waWindow) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site and try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "WhatsApp Opened",
        description: "Statement PDF link included in the message.",
      });
    } catch (error: any) {
      console.error("Error preparing WhatsApp message:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create share link.",
        variant: "destructive",
      });
    } finally {
      setWhatsappLoading(false);
      setStatementData(null);
      setIsGeneratingPdf(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Issue Statement
            </DialogTitle>
            <DialogDescription>
              Generate a statement for {customer.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Date Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Date Range</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={(date) => date && setDateFrom(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={(date) => date && setDateTo(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <Separator />

            {/* Statement Type */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Statement Type</Label>
              <RadioGroup
                value={statementType}
                onValueChange={(value) => setStatementType(value as "outstanding" | "activity")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="outstanding" id="outstanding" />
                  <div className="flex-1">
                    <Label htmlFor="outstanding" className="cursor-pointer font-medium">
                      Outstanding Only
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Shows only unpaid invoices and balances
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="activity" id="activity" />
                  <div className="flex-1">
                    <Label htmlFor="activity" className="cursor-pointer font-medium">
                      Activity Statement
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Full ledger including all invoices and payments
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Options */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Options</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="credit-notes" className="text-sm">Include Credit Notes</Label>
                    <p className="text-xs text-muted-foreground">Show credit notes in the statement</p>
                  </div>
                  <Switch
                    id="credit-notes"
                    checked={includeCreditNotes}
                    onCheckedChange={setIncludeCreditNotes}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="vat-breakdown" className="text-sm">Include VAT Breakdown</Label>
                    <p className="text-xs text-muted-foreground">Show VAT details for each item</p>
                  </div>
                  <Switch
                    id="vat-breakdown"
                    checked={includeVatBreakdown}
                    onCheckedChange={setIncludeVatBreakdown}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={handlePreviewPDF} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                  Preview PDF
                </Button>
                <Button variant="outline" onClick={handleDownload} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Download
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleSendEmail} disabled={isLoading || emailLoading || !customer.email} className="w-full">
                  {emailLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send via Email
                </Button>
                <Button variant="secondary" onClick={handleSendWhatsApp} disabled={isLoading || whatsappLoading} className="w-full">
                  {whatsappLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                  Send via WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden container for PDF generation - uses same id pattern as invoices */}
      {isGeneratingPdf && statementData && (() => {
        const converted = convertLegacyStatementData(statementData);
        return (
          <div 
            ref={statementContainerRef}
            style={{ 
              position: 'fixed',
              left: '-9999px',
              top: 0,
              width: '21cm',
              background: 'white',
              zIndex: -1,
            }}
          >
            <div id="invoice-preview-root">
              <UnifiedStatementLayout
                customer={converted.customer}
                companySettings={converted.companySettings}
                templateSettings={{
                  primaryColor: template?.primary_color || '#26A65B',
                  accentColor: template?.accent_color || '#1F2D3D',
                  fontFamily: template?.font_family || 'Inter',
                  style: (template?.style as 'modern' | 'professional' | 'minimalist') || 'modern',
                }}
                statementLines={converted.statementLines}
                dateRange={converted.dateRange}
                openingBalance={converted.openingBalance}
                closingBalance={converted.closingBalance}
                statementType={converted.statementType}
                variant="pdf"
              />
            </div>
          </div>
        );
      })()}

      {/* Email Dialog */}
      <SendDocumentEmailDialog
        open={showEmailDialog}
        onOpenChange={(open) => {
          setShowEmailDialog(open);
          if (!open) {
            setStatementData(null);
            setIsGeneratingPdf(false);
          }
        }}
        documentType="statement"
        documentId={customer.id}
        documentNumber={statementNumber}
        customer={{
          id: customer.id,
          name: customer.name,
          email: customer.email,
        }}
        companyName={companySettings?.company_name || "Your Company"}
        userId={user?.id || ""}
        fontFamily={template?.font_family || "Inter"}
        onSuccess={() => {
          toast({
            title: "Statement Sent",
            description: `Statement emailed to ${customer.email}`,
          });
        }}
      />
    </>
  );
};
