import { useState } from "react";
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
import { buildA4HtmlDocument } from "@/lib/edgePdf";

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
}: SendDocumentEmailDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const documentTypeLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).replace('_', ' ');
  const defaultSubject = `${documentTypeLabel} ${documentNumber} from ${companyName}`;
  const defaultMessage = `Dear ${customer.name},

Please find attached ${documentTypeLabel.toLowerCase()} ${documentNumber}.

If you have any questions, please don't hesitate to contact us.

Best regards,
${companyName}`;

  const [recipientEmail, setRecipientEmail] = useState(customer.email || "");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);

  const handleSend = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get the HTML from the preview
      const root = document.getElementById("invoice-preview-root") as HTMLElement | null;
      if (!root) {
        throw new Error("Document preview not found");
      }

      const html = buildA4HtmlDocument({
        filename: `${documentTypeLabel}-${documentNumber}`,
        fontFamily,
        clonedRoot: root.cloneNode(true) as HTMLElement,
      });

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
            PDF attachment will be included automatically
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading}>
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
    </Dialog>
  );
}
