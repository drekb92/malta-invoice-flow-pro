import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, AlertTriangle, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface ReminderLog {
  id: string;
  reminder_level: 'friendly' | 'firm' | 'final';
  sent_at: string;
  email_sent: boolean;
  email_error: string | null;
  days_overdue: number;
}

interface ReminderHistoryPanelProps {
  invoiceId: string;
  onReminderSent?: () => void;
}

export const ReminderHistoryPanel = ({ invoiceId, onReminderSent }: ReminderHistoryPanelProps) => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReminders = async () => {
    if (!user || !invoiceId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reminder_logs')
        .select('id, reminder_level, sent_at, email_sent, email_error, days_overdue')
        .eq('invoice_id', invoiceId)
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setReminders((data || []) as ReminderLog[]);
    } catch (error) {
      console.error('Error fetching reminder history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [user, invoiceId]);

  // Expose refetch for parent components
  useEffect(() => {
    if (onReminderSent) {
      // Re-fetch when parent signals a reminder was sent
    }
  }, [onReminderSent]);

  const getLevelConfig = (level: string) => {
    const configs: Record<string, { label: string; variant: "outline" | "default" | "destructive"; icon: typeof Mail }> = {
      friendly: { label: "Friendly", variant: "outline", icon: Mail },
      firm: { label: "Firm", variant: "default", icon: AlertTriangle },
      final: { label: "Final Notice", variant: "destructive", icon: AlertCircle },
    };
    return configs[level] || configs.friendly;
  };

  if (loading) {
    return null;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-2.5 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Reminder History
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {reminders.length} reminder{reminders.length !== 1 ? 's' : ''} sent
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-3">
        <div className="space-y-2">
          {reminders.map((reminder) => {
            const config = getLevelConfig(reminder.reminder_level);
            const Icon = config.icon;
            
            return (
              <div
                key={reminder.id}
                className="flex items-start gap-3 p-2.5 rounded-md border border-border/50 bg-muted/20"
              >
                <div className={`mt-0.5 p-1.5 rounded-full ${
                  reminder.email_sent 
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {reminder.email_sent ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={config.variant} className="text-xs">
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    {reminder.email_sent ? (
                      <span className="text-xs text-green-600 dark:text-green-400">Sent</span>
                    ) : (
                      <span className="text-xs text-red-600 dark:text-red-400">Failed</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{format(new Date(reminder.sent_at), "dd MMM yyyy, HH:mm")}</span>
                    {reminder.days_overdue > 0 && (
                      <>
                        <span>•</span>
                        <span>{reminder.days_overdue} day{reminder.days_overdue !== 1 ? 's' : ''} overdue</span>
                      </>
                    )}
                  </div>
                  
                  {reminder.email_error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                      Error: {reminder.email_error}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
