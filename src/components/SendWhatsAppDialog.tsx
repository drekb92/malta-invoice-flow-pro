/**
 * src/components/SendWhatsAppDialog.tsx
 *
 * A dialog for sending any document via WhatsApp.
 * Mirrors the structure of SendDocumentEmailDialog for UI consistency.
 *
 * It renders the document into a hidden UnifiedInvoiceLayout, generates a
 * signed PDF link via the create-document-share-link edge function, then
 * opens WhatsApp with a pre-filled message.
 */

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
import { MessageCircle, Loader2, Phone } from "lucide-react";
import { buildA4HtmlDocument, inlineImages, captureCssVars } from "@/lib/edgePdf";
import { normalisePhone } from "@/hooks/useWhatsApp";

export type WhatsAppDocumentType = "invoice" | "quotation" | "credit_note" | "statement";

interface SendWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: WhatsAppDocumentType;
  documentId: string;
  documentNumber: string;
  customer: {
    id: string;
    name: string;
    phone?: string | null;
  };
  companyName: string;
  userId: string;
  fontFamily?: string;
  /** Amount formatted as a number — displayed in the pre-filled message */
  totalAmount?: number;
  dueDate?: string;
  validUntil?: string;
  onSuccess?: () => void;
  /** Pre-filled message override */
  defaultMessageOverride?: string;
}

export function SendWhatsAppDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  documentNumber,
  customer,
  companyName,
  userId,
  fontFamily = "Inter",
  totalAmount,
  dueDate,
  validUntil,
  onSuccess,
  defaultMessageOverride,
}: SendWhatsAppDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const documentLabel =
    documentType === "credit_note" ? "Credit Note" : documentType.charAt(0).toUpperCase() + documentType.slice(1);

  const amountStr =
    totalAmount !== undefined
      ? `€${Number(totalAmount).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "";

  const formatDate = (d?: string) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("en-GB");
    } catch {
      return d;
    }
  };

  const buildDefaultMessage = (shareUrl = "[PDF link will appear here]") => {
    switch (documentType) {
      case "invoice":
        return `Hi ${customer.name},\n\nThis is a reminder for Invoice *${documentNumber}*${amountStr ? ` for ${amountStr}` : ""}${dueDate ? `, due on ${formatDate(dueDate)}` : ""}.\n\nView / download your invoice:\n${shareUrl}\n\nPlease get in touch if you have any questions.\n\n${companyName}`;
      case "credit_note":
        return `Hi ${customer.name},\n\nPlease find your Credit Note *${documentNumber}*${amountStr ? ` for ${amountStr}` : ""} here:\n${shareUrl}\n\n${companyName}`;
      case "quotation":
        return `Hi ${customer.name},\n\nPlease find your Quotation *${documentNumber}*${amountStr ? ` for ${amountStr}` : ""}${validUntil ? `, valid until ${formatDate(validUntil)}` : ""}:\n${shareUrl}\n\nLet us know if you'd like to proceed.\n\n${companyName}`;
      case "statement":
        return `Hi ${customer.name},\n\nPlease find your Account Statement here:\n${shareUrl}\n\n${companyName}`;
      default:
        return `Hi ${customer.name},\n\nPlease find your document here:\n${shareUrl}`;
    }
  };

  const [phone, setPhone] = useState(customer.phone || "");
  const [message, setMessage] = useState(defaultMessageOverride || buildDefaultMessage());

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setPhone(customer.phone || "");
      setMessage(defaultMessageOverride || buildDefaultMessage());
    }
  }, [open, customer.phone, defaultMessageOverride]);

  const handleSend = async () => {
    setLoading(true);
    try {
      // 1. Capture rendered document preview
      const root = document.getElementById("invoice-preview-root") as HTMLElement | null;
      if (!root) throw new Error("Document preview not found. Please make sure the document is visible.");

      const cloned = root.cloneNode(true) as HTMLElement;
      await inlineImages(cloned);

      const cssVars = captureCssVars(root);
      if (cssVars) {
        const existing = cloned.getAttribute("style") || "";
        cloned.setAttribute("style", `${existing}${existing ? " " : ""}${cssVars}`);
      }

      const html = buildA4HtmlDocument({
        filename: `${documentLabel}-${documentNumber}`,
        fontFamily,
        clonedRoot: cloned,
      });

      // 2. Upload PDF & get share URL
      const { data, error } = await supabase.functions.invoke("create-document-share-link", {
        body: {
          html,
          filename: `${documentLabel}-${documentNumber}`,
          userId,
          documentType,
          documentId,
          documentNumber,
          customerId: customer.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const shareUrl: string = data.url;

      // 3. Inject real URL into the message (replace placeholder)
      const finalMessage = message.replace("[PDF link will appear here]", shareUrl);

      // 4. Build WhatsApp URL
      const normPhone = normalisePhone(phone);
      const waUrl = normPhone
        ? `https://wa.me/${normPhone}?text=${encodeURIComponent(finalMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(finalMessage)}`;

      // 5. Open WhatsApp via redirect
      const waWindow = window.open(`/redirect?url=${encodeURIComponent(waUrl)}`, "_blank");
      if (!waWindow) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site and try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "WhatsApp opened",
        description: normPhone ? `Message ready for ${customer.name}.` : "Select a contact in WhatsApp to send.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("[SendWhatsAppDialog]", error);
      toast({
        title: "Failed to open WhatsApp",
        description: error.message || "An error occurred. Please try again.",
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
            <MessageCircle className="h-5 w-5 text-green-600" />
            Send {documentLabel} via WhatsApp
          </DialogTitle>
          <DialogDescription>
            A PDF link will be generated and a pre-filled message opened in WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Phone number */}
          <div className="grid gap-2">
            <Label htmlFor="wa_phone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Phone number
            </Label>
            <Input
              id="wa_phone"
              type="tel"
              placeholder="+356 XXXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Include country code (e.g. +356 for Malta). Leave blank to choose a contact in WhatsApp.
            </p>
          </div>

          {/* Message preview */}
          <div className="grid gap-2">
            <Label htmlFor="wa_message">Message preview</Label>
            <Textarea
              id="wa_message"
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              The PDF link will replace the placeholder automatically when sent.
            </p>
          </div>

          {/* Info strip */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-green-50 border border-green-200 rounded-md px-3 py-2">
            <MessageCircle className="h-4 w-4 text-green-600 shrink-0" />
            <span>A signed PDF link (valid 7 days) will be generated and included automatically.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating link…
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4 mr-2" />
                Open WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
