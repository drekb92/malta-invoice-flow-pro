import { useState } from "react";
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
import { useReminders } from "@/hooks/useReminders";
import { Mail, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";

interface SendReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  customerName?: string;
  onSuccess?: () => void;
}

export const SendReminderDialog = ({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  customerName,
  onSuccess,
}: SendReminderDialogProps) => {
  const [selectedLevel, setSelectedLevel] = useState<'friendly' | 'firm' | 'final'>('friendly');
  const { sendReminder, sending } = useReminders();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Payment Reminder</DialogTitle>
          <DialogDescription>
            Send a reminder for invoice {invoiceNumber}
            {customerName && ` to ${customerName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="text-sm font-medium mb-3 block">
            Select reminder level:
          </Label>
          <RadioGroup
            value={selectedLevel}
            onValueChange={(value) => setSelectedLevel(value as 'friendly' | 'firm' | 'final')}
            className="space-y-3"
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
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
