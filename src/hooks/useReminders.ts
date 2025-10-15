import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useReminders = () => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const sendReminder = async (invoiceId: string, level: 'friendly' | 'firm' | 'final') => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-payment-reminder', {
        body: {
          invoice_id: invoiceId,
          reminder_level: level,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Reminder Sent",
          description: `Payment reminder (${level}) has been sent successfully.`,
        });
        return { success: true };
      } else {
        throw new Error(data?.error || 'Failed to send reminder');
      }
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send payment reminder",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setSending(false);
    }
  };

  const getReminderLogs = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('reminder_logs')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching reminder logs:', error);
      return [];
    }
  };

  return {
    sendReminder,
    getReminderLogs,
    sending,
  };
};
