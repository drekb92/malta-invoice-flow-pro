import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2 } from "lucide-react";
import { buildA4HtmlDocument, prepareHtmlForPdf, inlineImages, captureCssVars } from "@/lib/edgePdf";
import { useInvoicePdfData } from "@/hooks/useInvoicePdfData";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";

interface SendDocumentEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: 'invoice' | 'quotation' | 'statement' | 'credit_note';
  documentId: string;
  documentNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  companyName: string;
  userId: string;
  fontFamily?: string;
  onSuccess?: () => void;
  /** Override the default subject line */
  defaultSubjectOverride?: string;
  /** Override the default message body */
  defaultMessageOverride?: string;
  /** Set to true if an invoice-preview-root element already exists in the DOM */
  previewAvailable?: boolean;
}

export function SendDocumentEmailDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  documentNumber,
  customer,
  companyName,
  userId,
  fontFamily = "Inter",
  onSuccess,
  defaultSubjectOverride,
  defaultMessageOverride,
  previewAvailable,
}: SendDocumentEmailDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Determine if we need to fetch invoice data for dynamic preview
  const needsDynamicPreview = documentType === 'invoice' && previewAvailable === false;
  
  // Fetch invoice data only when dialog is open and we need dynamic preview
  const { data: invoicePdfData, isLoading: pdfDataLoading, isReady: pdfDataReady } = useInvoicePdfData(
    needsDynamicPreview ? documentId : null,
    needsDynamicPreview && open
  );

  const documentTypeLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).replace('_', ' ');
  
  // Compute defaults (can be overridden via props)
  const computedDefaultSubject = defaultSubjectOverride || `${documentTypeLabel} ${documentNumber} from ${companyName}`;
  const computedDefaultMessage = defaultMessageOverride || `Dear ${customer.name},

Please find attached ${documentTypeLabel.toLowerCase()} ${documentNumber}.

If you have any questions, please don't hesitate to contact us.

Best regards,
${companyName}`;

  const [recipientEmail, setRecipientEmail] = useState(customer.email || "");
  const [subject, setSubject] = useState(computedDefaultSubject);
  const [message, setMessage] = useState(computedDefaultMessage);

  // Reset form when dialog opens or key inputs change
  useEffect(() => {
    if (open) {
      setRecipientEmail(customer.email || "");
      setSubject(computedDefaultSubject);
      setMessage(computedDefaultMessage);
    }
  }, [open, customer.email, computedDefaultSubject, computedDefaultMessage]);

  /**
   * Wait for the invoice-preview-root element to be available in the DOM
   */
  const waitForPreviewRoot = async (maxWaitMs = 3000): Promise<HTMLElement | null> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const root = document.getElementById("invoice-preview-root");
      if (root) return root;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
  };

  /**
   * Generate HTML for PDF from the preview root (either external or internal)
   */
  const generatePdfHtml = async (): Promise<string> => {
    // First check if an external preview root exists
    let root = document.getElementById("invoice-preview-root");
    
    // If no external preview and we're using dynamic preview, wait for internal one
    if (!root && needsDynamicPreview) {
      root = await waitForPreviewRoot();
    }
    
    if (!root) {
      throw new Error("Preview root not found (invoice-preview-root).");
    }

    const cloned = root.cloneNode(true) as HTMLElement;
    await inlineImages(cloned);

    const cssVars = captureCssVars(root);
    if (cssVars) {
      const existingStyle = cloned.getAttribute("style") || "";
      cloned.setAttribute("style", `${existingStyle}${existingStyle ? " " : ""}${cssVars}`);
    }

    return buildA4HtmlDocument({
      filename: `${documentTypeLabel}-${documentNumber}`,
      fontFamily,
      clonedRoot: cloned,
    });
  };

  const handleSend = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    // For dynamic preview, ensure data is ready
    if (needsDynamicPreview && !pdfDataReady) {
      toast({
        title: "Loading invoice data",
        description: "Please wait while invoice data is being loaded.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Generate HTML from preview
      const html = await generatePdfHtml();

      const messageHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${message.split('\n').map(line => `<p style="margin: 0 0 10px 0;">${line || '&nbsp;'}</p>`).join('')}
        </div>
      `;

      const { data, error } = await supabase.functions.invoke("send-document-email", {
        body: {
          to: recipientEmail,
          subject,
          messageHtml,
          filename: `${documentTypeLabel}-${documentNumber}`,
          html,
          userId,
          documentType,
          documentId,
          documentNumber,
          customerId: customer.id,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Email sent",
        description: `${documentTypeLabel} sent to ${recipientEmail}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("[SendDocumentEmailDialog] Error:", error);
      toast({
        title: "Failed to send email",
        description: error.message || "An error occurred while sending the email.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Determine if send button should be disabled
  const isSendDisabled = loading || (needsDynamicPreview && !pdfDataReady);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send {documentTypeLabel} via Email
          </DialogTitle>
          <DialogDescription>
            Send {documentNumber} to {customer.name} with PDF attachment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email_to">To</Label>
            <Input
              id="email_to"
              type="email"
              placeholder="customer@email.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email_subject">Subject</Label>
            <Input
              id="email_subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email_message">Message</Label>
            <Textarea
              id="email_message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            <Mail className="h-4 w-4" />
            {needsDynamicPreview && pdfDataLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading invoice data...
              </>
            ) : (
              "PDF attachment will be included automatically"
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSendDisabled}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Hidden preview for PDF generation when no external preview exists */}
      {needsDynamicPreview && pdfDataReady && invoicePdfData && (
        <div
          ref={previewContainerRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '210mm',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <UnifiedInvoiceLayout
            id="invoice-preview-root"
            variant="pdf"
            invoiceData={invoicePdfData.invoiceData}
            companySettings={invoicePdfData.companySettings}
            bankingSettings={invoicePdfData.bankingSettings}
            templateSettings={invoicePdfData.templateSettings}
            footerText={invoicePdfData.footerText}
            documentType="INVOICE"
          />
        </div>
      )}
    </Dialog>
  );
}
