import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ReminderSettings {
  reminder_mode: 'automatic' | 'manual';
  email_reminders_enabled: boolean;
  days_before_due: number;
  days_after_due_first: number;
  days_after_due_second: number;
  days_after_due_final: number;
  max_reminders: number;
  stop_after_payment: boolean;
}

interface ReminderLog {
  id: string;
  reminder_level: 'friendly' | 'firm' | 'final';
  sent_at: string;
  email_sent: boolean;
}

export interface ReminderStatus {
  shouldShowReminder: boolean;
  recommendedLevel: 'friendly' | 'firm' | 'final';
  daysOverdue: number;
  lastReminderSent?: Date;
  lastReminderLevel?: 'friendly' | 'firm' | 'final';
  reminderCount: number;
  isManualMode: boolean;
  loading: boolean;
}

interface UseReminderStatusProps {
  invoiceId: string;
  dueDate: string;
  status: string;
  remainingBalance: number;
}

export const useReminderStatus = ({
  invoiceId,
  dueDate,
  status,
  remainingBalance,
}: UseReminderStatusProps): ReminderStatus => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>([]);

  useEffect(() => {
    if (!user || !invoiceId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch reminder settings
        const { data: settingsData } = await supabase
          .from('reminder_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settingsData) {
          setSettings(settingsData as ReminderSettings);
        }

        // Fetch reminder logs for this invoice
        const { data: logsData } = await supabase
          .from('reminder_logs')
          .select('id, reminder_level, sent_at, email_sent')
          .eq('invoice_id', invoiceId)
          .eq('user_id', user.id)
          .order('sent_at', { ascending: false });

        if (logsData) {
          setReminderLogs(logsData as ReminderLog[]);
        }
      } catch (error) {
        console.error('Error fetching reminder status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, invoiceId]);

  // Calculate days overdue
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

  // Default return if still loading or no settings
  if (loading || !settings) {
    return {
      shouldShowReminder: false,
      recommendedLevel: 'friendly',
      daysOverdue,
      reminderCount: 0,
      isManualMode: true,
      loading,
    };
  }

  // Don't show reminders if:
  // - Invoice is paid/settled
  // - Invoice is draft
  // - Email reminders are disabled
  // - Mode is automatic (cron handles it)
  const isPaid = status === 'paid' || remainingBalance <= 0;
  const isDraft = status === 'draft';
  const isManualMode = settings.reminder_mode === 'manual' || !settings.reminder_mode;

  if (isPaid || isDraft || !settings.email_reminders_enabled || !isManualMode) {
    return {
      shouldShowReminder: false,
      recommendedLevel: 'friendly',
      daysOverdue,
      lastReminderSent: reminderLogs[0] ? new Date(reminderLogs[0].sent_at) : undefined,
      lastReminderLevel: reminderLogs[0]?.reminder_level,
      reminderCount: reminderLogs.length,
      isManualMode,
      loading: false,
    };
  }

  // Check if max reminders reached
  const successfulReminders = reminderLogs.filter(r => r.email_sent);
  if (successfulReminders.length >= settings.max_reminders) {
    return {
      shouldShowReminder: false,
      recommendedLevel: 'final',
      daysOverdue,
      lastReminderSent: reminderLogs[0] ? new Date(reminderLogs[0].sent_at) : undefined,
      lastReminderLevel: reminderLogs[0]?.reminder_level,
      reminderCount: successfulReminders.length,
      isManualMode,
      loading: false,
    };
  }

  // Determine recommended level based on days overdue
  let recommendedLevel: 'friendly' | 'firm' | 'final' = 'friendly';
  let shouldShowReminder = false;

  if (daysOverdue >= settings.days_after_due_final) {
    recommendedLevel = 'final';
    shouldShowReminder = true;
  } else if (daysOverdue >= settings.days_after_due_second) {
    recommendedLevel = 'firm';
    shouldShowReminder = true;
  } else if (daysOverdue >= settings.days_after_due_first) {
    recommendedLevel = 'firm';
    shouldShowReminder = true;
  } else if (daysOverdue >= 0) {
    // Due today or past due
    recommendedLevel = 'friendly';
    shouldShowReminder = true;
  } else if (daysOverdue >= -settings.days_before_due) {
    // Approaching due date
    recommendedLevel = 'friendly';
    shouldShowReminder = true;
  }

  // Check if we already sent a reminder at this level recently (within 3 days)
  const lastReminder = reminderLogs[0];
  if (lastReminder) {
    const daysSinceLastReminder = Math.floor(
      (today.getTime() - new Date(lastReminder.sent_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // If we sent a reminder less than 3 days ago, don't prompt again
    if (daysSinceLastReminder < 3) {
      shouldShowReminder = false;
    }
    
    // Escalate level if we already sent at this level
    if (lastReminder.reminder_level === 'friendly' && daysOverdue >= settings.days_after_due_first) {
      recommendedLevel = 'firm';
    } else if (lastReminder.reminder_level === 'firm' && daysOverdue >= settings.days_after_due_final) {
      recommendedLevel = 'final';
    }
  }

  return {
    shouldShowReminder,
    recommendedLevel,
    daysOverdue,
    lastReminderSent: lastReminder ? new Date(lastReminder.sent_at) : undefined,
    lastReminderLevel: lastReminder?.reminder_level,
    reminderCount: successfulReminders.length,
    isManualMode,
    loading: false,
  };
};
