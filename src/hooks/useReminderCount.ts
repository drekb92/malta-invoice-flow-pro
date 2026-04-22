import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useReminderCount = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id")
      .eq("user_id", user.id)
      .not("status", "in", "(paid,draft,cancelled)")
      .lt("due_date", today.toISOString().split("T")[0]);

    if (!invoices || invoices.length === 0) {
      setCount(0);
      return;
    }

    const invoiceIds = invoices.map((i) => i.id);

    const { data: logs } = await supabase
      .from("reminder_logs")
      .select("invoice_id, sent_at")
      .in("invoice_id", invoiceIds)
      .eq("email_sent", true)
      .order("sent_at", { ascending: false });

    const lastSentMap: Record<string, Date> = {};
    logs?.forEach((log) => {
      if (!lastSentMap[log.invoice_id]) {
        lastSentMap[log.invoice_id] = new Date(log.sent_at);
      }
    });

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const needsReminder = invoices.filter((inv) => {
      const lastSent = lastSentMap[inv.id];
      return !lastSent || lastSent < threeDaysAgo;
    });

    setCount(needsReminder.length);
  }, [user]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { count, refetch: fetchCount };
};
