import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ShareLink {
  id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

interface UseInvoiceShareLinkReturn {
  shareLink: ShareLink | null;
  loading: boolean;
  creating: boolean;
  revoking: boolean;
  createLink: () => Promise<void>;
  revokeLink: () => Promise<void>;
  publicUrl: string | null;
}

export function useInvoiceShareLink(invoiceId: string | undefined): UseInvoiceShareLinkReturn {
  const { user } = useAuth();
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const fetchLink = useCallback(async () => {
    if (!invoiceId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("invoice_share_links")
      .select("*")
      .eq("invoice_id", invoiceId)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setShareLink(data as ShareLink | null);
    setLoading(false);
  }, [invoiceId, user]);

  useEffect(() => {
    fetchLink();
  }, [fetchLink]);

  const createLink = useCallback(async () => {
    if (!invoiceId || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("invoice_share_links")
        .insert({ invoice_id: invoiceId, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setShareLink(data as ShareLink);
    } finally {
      setCreating(false);
    }
  }, [invoiceId, user]);

  const revokeLink = useCallback(async () => {
    if (!shareLink) return;
    setRevoking(true);
    try {
      const { error } = await supabase
        .from("invoice_share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", shareLink.id);
      if (error) throw error;
      setShareLink(null);
    } finally {
      setRevoking(false);
    }
  }, [shareLink]);

  const publicUrl = shareLink ? `${window.location.origin}/view/${shareLink.token}` : null;

  return { shareLink, loading, creating, revoking, createLink, revokeLink, publicUrl };
}
