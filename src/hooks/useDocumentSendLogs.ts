import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface SendLogEntry {
  sentAt: string;
  recipient?: string;
  shareUrl?: string;
}

interface UseDocumentSendLogsResult {
  lastEmailSent: SendLogEntry | null;
  lastWhatsAppSent: SendLogEntry | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useDocumentSendLogs(
  documentType: 'invoice' | 'quotation' | 'statement' | 'credit_note',
  documentId: string
): UseDocumentSendLogsResult {
  const { user } = useAuth();
  const [lastEmailSent, setLastEmailSent] = useState<SendLogEntry | null>(null);
  const [lastWhatsAppSent, setLastWhatsAppSent] = useState<SendLogEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user || !documentId) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch latest email send
      const { data: emailLogs } = await supabase
        .from("document_send_logs")
        .select("sent_at, recipient_email")
        .eq("user_id", user.id)
        .eq("document_type", documentType)
        .eq("document_id", documentId)
        .eq("channel", "email")
        .eq("success", true)
        .order("sent_at", { ascending: false })
        .limit(1);

      if (emailLogs && emailLogs.length > 0) {
        setLastEmailSent({
          sentAt: emailLogs[0].sent_at,
          recipient: emailLogs[0].recipient_email || undefined,
        });
      } else {
        setLastEmailSent(null);
      }

      // Fetch latest WhatsApp send
      const { data: whatsappLogs } = await supabase
        .from("document_send_logs")
        .select("sent_at, share_url")
        .eq("user_id", user.id)
        .eq("document_type", documentType)
        .eq("document_id", documentId)
        .eq("channel", "whatsapp")
        .eq("success", true)
        .order("sent_at", { ascending: false })
        .limit(1);

      if (whatsappLogs && whatsappLogs.length > 0) {
        setLastWhatsAppSent({
          sentAt: whatsappLogs[0].sent_at,
          shareUrl: whatsappLogs[0].share_url || undefined,
        });
      } else {
        setLastWhatsAppSent(null);
      }
    } catch (error) {
      console.error("[useDocumentSendLogs] Error fetching logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, documentType, documentId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    lastEmailSent,
    lastWhatsAppSent,
    isLoading,
    refetch: fetchLogs,
  };
}
