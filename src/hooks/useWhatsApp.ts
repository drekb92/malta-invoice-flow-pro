/**
 * src/hooks/useWhatsApp.ts
 *
 * Reusable hook for sending any document type via WhatsApp.
 * Uses the existing create-document-share-link edge function to generate
 * a signed PDF URL, then opens WhatsApp Web / app with a pre-filled message.
 *
 * Usage:
 *   const { sendWhatsApp, sending } = useWhatsApp();
 *   await sendWhatsApp({ ... });
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { buildA4HtmlDocument, inlineImages, captureCssVars } from "@/lib/edgePdf";

export type WhatsAppDocumentType = "invoice" | "quotation" | "credit_note" | "statement";

export interface SendWhatsAppOptions {
  /** Document type — controls the message template */
  documentType: WhatsAppDocumentType;
  /** Document ID in the database */
  documentId: string;
  /** Human-readable document number, e.g. "INV-001" */
  documentNumber: string;
  /** Customer name for the message */
  customerName: string;
  /** Customer phone (digits only). If omitted, WhatsApp opens without a pre-filled recipient. */
  customerPhone?: string | null;
  /** Customer ID for logging */
  customerId?: string;
  /** Authenticated user ID for logging */
  userId: string;
  /** Grand total for display in the message */
  totalAmount?: number;
  /** Due date string (ISO or dd/MM/yyyy) */
  dueDate?: string;
  /** Valid until date for quotations */
  validUntil?: string;
  /** Font family used in the PDF */
  fontFamily?: string;
  /**
   * ID of the DOM element that contains the rendered document preview.
   * Defaults to "invoice-preview-root" — the standard id used by all layouts.
   */
  previewElementId?: string;
}

/**
 * Format a phone number to international E.164 format.
 * Strips all non-digits, then adds Malta country code (+356) if the number
 * is 8 digits (local MT number) and doesn't already start with a country code.
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Already has a country code (more than 10 digits or starts with 00/+)
  if (digits.length > 10) return digits;
  // Malta local numbers are 8 digits
  if (digits.length === 8) return `356${digits}`;
  return digits;
}

/**
 * Build the WhatsApp message text based on document type.
 */
function buildWhatsAppMessage(opts: SendWhatsAppOptions, shareUrl: string): string {
  const { documentType, documentNumber, customerName, totalAmount, dueDate, validUntil } = opts;

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

  switch (documentType) {
    case "invoice":
      return [
        `Hi ${customerName},`,
        ``,
        `This is a reminder for Invoice *${documentNumber}*${amountStr ? ` for ${amountStr}` : ""}${dueDate ? `, due on ${formatDate(dueDate)}` : ""}.`,
        ``,
        `You can view and download your invoice here:`,
        shareUrl,
        ``,
        `Please don't hesitate to get in touch if you have any questions.`,
      ].join("\n");

    case "credit_note":
      return [
        `Hi ${customerName},`,
        ``,
        `Please find your Credit Note *${documentNumber}*${amountStr ? ` for ${amountStr}` : ""} attached.`,
        ``,
        `View / download PDF:`,
        shareUrl,
      ].join("\n");

    case "quotation":
      return [
        `Hi ${customerName},`,
        ``,
        `Please find your Quotation *${documentNumber}*${amountStr ? ` for ${amountStr}` : ""}${validUntil ? `, valid until ${formatDate(validUntil)}` : ""}.`,
        ``,
        `View / download PDF:`,
        shareUrl,
        ``,
        `Let us know if you'd like to proceed or have any questions.`,
      ].join("\n");

    case "statement":
      return [
        `Hi ${customerName},`,
        ``,
        `Please find your Account Statement attached.`,
        ``,
        `View / download PDF:`,
        shareUrl,
      ].join("\n");

    default:
      return `Hi ${customerName},\n\nPlease find your document here:\n${shareUrl}`;
  }
}

export function useWhatsApp() {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const sendWhatsApp = async (opts: SendWhatsAppOptions): Promise<boolean> => {
    const {
      documentType,
      documentId,
      documentNumber,
      customerId,
      userId,
      fontFamily = "Inter",
      previewElementId = "invoice-preview-root",
    } = opts;

    setSending(true);
    try {
      // 1. Capture the rendered preview
      const root = document.getElementById(previewElementId) as HTMLElement | null;
      if (!root) {
        throw new Error(
          `Document preview element (#${previewElementId}) not found. ` +
            `Make sure the document is rendered before calling sendWhatsApp.`,
        );
      }

      const cloned = root.cloneNode(true) as HTMLElement;
      await inlineImages(cloned);

      const cssVars = captureCssVars(root);
      if (cssVars) {
        const existing = cloned.getAttribute("style") || "";
        cloned.setAttribute("style", `${existing}${existing ? " " : ""}${cssVars}`);
      }

      const html = buildA4HtmlDocument({
        filename: `${documentType}-${documentNumber}`,
        fontFamily,
        clonedRoot: cloned,
      });

      // 2. Upload PDF & get signed share URL
      const { data, error } = await supabase.functions.invoke("create-document-share-link", {
        body: {
          html,
          filename: `${documentType}-${documentNumber}`,
          userId,
          documentType,
          documentId,
          documentNumber,
          customerId: customerId || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const shareUrl: string = data.url;

      // 3. Build message and open WhatsApp
      const message = buildWhatsAppMessage(opts, shareUrl);
      const phone = normalisePhone(opts.customerPhone || "");

      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      // Open via /redirect to avoid cross-origin popup blocking
      const waWindow = window.open(`/redirect?url=${encodeURIComponent(waUrl)}`, "_blank");
      if (!waWindow) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site and try again.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "WhatsApp opened",
        description: phone
          ? `Message ready to send to ${opts.customerName}.`
          : "Message ready — select a contact in WhatsApp.",
      });

      return true;
    } catch (error: any) {
      console.error("[useWhatsApp] Error:", error);
      toast({
        title: "WhatsApp failed",
        description: error.message || "Could not create the share link. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSending(false);
    }
  };

  return { sendWhatsApp, sending };
}
