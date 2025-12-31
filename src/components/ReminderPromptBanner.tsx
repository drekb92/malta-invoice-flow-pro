import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Clock, CheckCircle, Loader2 } from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import { format } from "date-fns";
import type { ReminderStatus } from "@/hooks/useReminderStatus";

interface ReminderPromptBannerProps {
  invoiceId: string;
  invoiceNumber: string;
  reminderStatus: ReminderStatus;
  onReminderSent?: () => void;
}

export const ReminderPromptBanner = ({
  invoiceId,
  invoiceNumber,
  reminderStatus,
  onReminderSent,
}: ReminderPromptBannerProps) => {
  const { sendReminder, sending } = useReminders();
  const [sentLevel, setSentLevel] = useState<string | null>(null);

  const { 
    shouldShowReminder, 
    recommendedLevel, 
    daysOverdue,
    lastReminderSent,
    lastReminderLevel,
    reminderCount,
  } = reminderStatus;

  if (!shouldShowReminder) {
    return null;
  }

  const handleSendReminder = async (level: 'friendly' | 'firm' | 'final') => {
    const result = await sendReminder(invoiceId, level);
    if (result.success) {
      setSentLevel(level);
      onReminderSent?.();
    }
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      friendly: 'Friendly',
      firm: 'Firm',
      final: 'Final Notice',
    };
    return labels[level] || level;
  };

  const getLevelDescription = (level: string) => {
    const descriptions: Record<string, string> = {
      friendly: 'A polite reminder about the upcoming/due payment',
      firm: 'A professional but firm reminder about the overdue payment',
      final: 'A final notice with legal language about debt collection',
    };
    return descriptions[level] || '';
  };

  // If we just sent a reminder, show success state
  if (sentLevel) {
    return (
      <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50">
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-200">Reminder Sent</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          {getLevelLabel(sentLevel)} reminder for Invoice {invoiceNumber} has been sent successfully.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50">
      <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
        Payment Reminder Due
        <Badge variant="outline" className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
          {daysOverdue > 0 ? `${daysOverdue} days overdue` : daysOverdue === 0 ? 'Due today' : `Due in ${Math.abs(daysOverdue)} days`}
        </Badge>
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <div className="space-y-3">
          <p className="text-sm">
            {daysOverdue > 0 
              ? `This invoice is ${daysOverdue} days past the due date.`
              : daysOverdue === 0 
              ? 'This invoice is due today.'
              : `This invoice is due in ${Math.abs(daysOverdue)} days.`}
            {' '}Recommended action: Send a <strong>{getLevelLabel(recommendedLevel).toLowerCase()}</strong> reminder.
          </p>
          
          {lastReminderSent && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last reminder ({getLevelLabel(lastReminderLevel || '')}) sent {format(lastReminderSent, 'dd MMM yyyy')}
              {reminderCount > 0 && ` • ${reminderCount} reminder${reminderCount > 1 ? 's' : ''} sent total`}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button 
              onClick={() => handleSendReminder('friendly')} 
              variant={recommendedLevel === 'friendly' ? 'default' : 'outline'}
              size="sm"
              disabled={sending}
              className={recommendedLevel === 'friendly' ? '' : 'border-amber-300 dark:border-amber-700'}
            >
              {sending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
              Friendly
            </Button>
            <Button 
              onClick={() => handleSendReminder('firm')} 
              variant={recommendedLevel === 'firm' ? 'default' : 'outline'}
              size="sm"
              disabled={sending}
              className={recommendedLevel === 'firm' ? '' : 'border-amber-300 dark:border-amber-700'}
            >
              {sending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
              Firm
            </Button>
            <Button 
              onClick={() => handleSendReminder('final')} 
              variant={recommendedLevel === 'final' ? 'destructive' : 'outline'}
              size="sm"
              disabled={sending}
              className={recommendedLevel === 'final' ? '' : 'border-amber-300 dark:border-amber-700'}
            >
              {sending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
              Final Notice
            </Button>
          </div>
          
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
            {getLevelDescription(recommendedLevel)}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
};
