import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useReminders } from "@/hooks/useReminders";
import { supabase } from "@/integrations/supabase/client";
import { Mail, AlertTriangle, AlertCircle, Loader2, FileText } from "lucide-react";
import { format } from "date-fns";

interface SendReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  customerName?: string;
  customerEmail?: string | null;
  invoiceAmount?: number;
  dueDate?: string | null;
  daysOverdue?: number;
  companyName?: string;
  currencySymbol?: string;
  onSuccess?: () => void;
}

interface ReminderTemplate {
  level: 'friendly' | 'firm' | 'final';
  subject: string;
  body: string;
}

export const SendReminderDialog = ({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  customerName,
  customerEmail,
  invoiceAmount,
  dueDate,
  daysOverdue,
  companyName,
  currencySymbol = "€",
  onSuccess,
}: SendReminderDialogProps) => {
  const [selectedLevel, setSelectedLevel] = useState<'friendly' | 'firm' | 'final'>('friendly');
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const { sendReminder, sending } = useReminders();

  // Fetch templates when dialog opens
  useEffect(() => {
    if (open) {
      const fetchTemplates = async () => {
        const { data } = await supabase
          .from('reminder_templates')
          .select('level, subject, body')
          .eq('is_default', true);
        if (data) {
          setTemplates(data as ReminderTemplate[]);
        }
      };
      fetchTemplates();
    }
  }, [open]);

  const handleSend = async () => {
    const result = await sendReminder(invoiceId, selectedLevel);
    if (result.success) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const levels = [
    {
      value: 'friendly' as const,
      label: 'Friendly Reminder',
      description: 'A polite first reminder for the payment',
      icon: Mail,
    },
    {
      value: 'firm' as const,
      label: 'Firm Reminder',
      description: 'A more direct follow-up message',
      icon: AlertTriangle,
    },
    {
      value: 'final' as const,
      label: 'Final Notice',
      description: 'Last warning before further action',
      icon: AlertCircle,
    },
  ];

  // Get preview content by substituting placeholders
  const getPreviewContent = () => {
    const template = templates.find(t => t.level === selectedLevel);
    if (!template) return { subject: '', body: '' };

    const formattedAmount = invoiceAmount !== undefined 
      ? `${currencySymbol}${invoiceAmount.toFixed(2)}` 
      : '';
    const formattedDueDate = dueDate ? format(new Date(dueDate), 'dd MMMM yyyy') : '';

    const substitutions: Record<string, string> = {
      '{customer_name}': customerName || '',
      '{invoice_number}': invoiceNumber,
      '{amount}': formattedAmount,
      '{due_date}': formattedDueDate,
      '{days_overdue}': String(daysOverdue || 0),
      '{company_name}': companyName || '',
    };

    let subject = template.subject;
    let body = template.body;

    Object.entries(substitutions).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
      body = body.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return { subject, body };
  };

  const preview = getPreviewContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Payment Reminder</DialogTitle>
          <DialogDescription>
            Send a reminder for invoice {invoiceNumber}
            {customerName && ` to ${customerName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Recipient Email Display */}
          {customerEmail ? (
            <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded-md">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Sending to:</span>
              <span className="font-medium">{customerEmail}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>No email address on file for this customer</span>
            </div>
          )}

          {/* Reminder Level Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Select reminder level:
            </Label>
            <RadioGroup
              value={selectedLevel}
              onValueChange={(value) => setSelectedLevel(value as 'friendly' | 'firm' | 'final')}
              className="space-y-2"
            >
              {levels.map((level) => {
                const Icon = level.icon;
                return (
                  <div
                    key={level.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedLevel === level.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                    onClick={() => setSelectedLevel(level.value)}
                  >
                    <RadioGroupItem value={level.value} id={level.value} className="mt-0.5" />
                    <div className="flex-1">
                      <label
                        htmlFor={level.value}
                        className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                      >
                        <Icon className="h-4 w-4" />
                        {level.label}
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {level.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Email Preview */}
          {templates.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-3 py-2 text-xs font-medium flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Email Preview
              </div>
              <div className="p-3 space-y-2">
                <div className="text-sm">
                  <span className="font-semibold text-muted-foreground">Subject: </span>
                  <span>{preview.subject}</span>
                </div>
                <Separator />
                <div className="text-sm whitespace-pre-wrap text-muted-foreground max-h-32 overflow-y-auto">
                  {preview.body}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !customerEmail}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Reminder'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
