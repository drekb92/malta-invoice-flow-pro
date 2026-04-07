/**
 * src/components/SendReminderDialog.tsx
 *
 * Payment reminder dialog — supports both Email and WhatsApp channels.
 */

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReminders } from "@/hooks/useReminders";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { supabase } from "@/integrations/supabase/client";
import { Mail, AlertTriangle, AlertCircle, Loader2, FileText, MessageCircle } from "lucide-react";
import { format } from "date-fns";

interface SendReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  customerName?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  invoiceAmount?: number;
  dueDate?: string | null;
  daysOverdue?: number;
  companyName?: string;
  currencySymbol?: string;
  userId?: string;
  onSuccess?: () => void;
}

interface ReminderTemplate {
  level: "friendly" | "firm" | "final";
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
  customerPhone,
  invoiceAmount,
  dueDate,
  daysOverdue,
  companyName,
  currencySymbol = "€",
  userId,
  onSuccess,
}: SendReminderDialogProps) => {
  const [selectedLevel, setSelectedLevel] = useState<"friendly" | "firm" | "final">("friendly");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const { sendReminder, sending: sendingEmail } = useReminders();
  const { sendWhatsApp, sending: sendingWhatsApp } = useWhatsApp();

  const sending = sendingEmail || sendingWhatsApp;

  useEffect(() => {
    if (open) {
      // Default to whatsapp if no email but phone exists
      if (!customerEmail && customerPhone) setChannel("whatsapp");
      else setChannel("email");

      const fetchTemplates = async () => {
        const { data } = await supabase
          .from("reminder_templates")
          .select("level, subject, body")
          .eq("is_default", true);
        if (data) setTemplates(data as ReminderTemplate[]);
      };
      fetchTemplates();
    }
  }, [open, customerEmail, customerPhone]);

  const levels = [
    {
      value: "friendly" as const,
      label: "Friendly Reminder",
      description: "A polite first reminder for the payment",
      icon: Mail,
    },
    {
      value: "firm" as const,
      label: "Firm Reminder",
      description: "A more direct follow-up message",
      icon: AlertTriangle,
    },
    {
      value: "final" as const,
      label: "Final Notice",
      description: "Last warning before further action",
      icon: AlertCircle,
    },
  ];

  const getSubstitutedTemplate = () => {
    const template = templates.find((t) => t.level === selectedLevel);
    if (!template) return { subject: "", body: "" };

    const formattedAmount = invoiceAmount !== undefined ? `${currencySymbol}${invoiceAmount.toFixed(2)}` : "";
    const formattedDueDate = dueDate ? format(new Date(dueDate), "dd MMMM yyyy") : "";

    const subs: Record<string, string> = {
      "{customer_name}": customerName || "",
      "{invoice_number}": invoiceNumber,
      "{amount}": formattedAmount,
      "{due_date}": formattedDueDate,
      "{days_overdue}": String(daysOverdue || 0),
      "{company_name}": companyName || "",
    };

    let subject = template.subject;
    let body = template.body;
    Object.entries(subs).forEach(([k, v]) => {
      const re = new RegExp(k.replace(/[{}]/g, "\\$&"), "g");
      subject = subject.replace(re, v);
      body = body.replace(re, v);
    });
    return { subject, body };
  };

  const preview = getSubstitutedTemplate();

  const handleSend = async () => {
    if (channel === "email") {
      const result = await sendReminder(invoiceId, selectedLevel);
      if (result.success) {
        onSuccess?.();
        onOpenChange(false);
      }
      return;
    }

    // WhatsApp channel — build the message from the reminder template body
    if (!userId) return;

    const success = await sendWhatsApp({
      documentType: "invoice",
      documentId: invoiceId,
      documentNumber: invoiceNumber,
      customerName: customerName || "Customer",
      customerPhone: customerPhone,
      customerId: undefined,
      userId,
      totalAmount: invoiceAmount,
      dueDate: dueDate || undefined,
      fontFamily: "Inter",
      // The message is built inside useWhatsApp — but we can pass a body override
      // by opening WhatsApp with the template body as the message text
    });

    if (success) {
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const canSendEmail = !!customerEmail;
  const canSendWhatsApp = true; // Always allowed — user can choose a contact in WA if no phone
  const isSendDisabled = sending || (channel === "email" && !canSendEmail);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Payment Reminder</DialogTitle>
          <DialogDescription>
            Send a reminder for invoice {invoiceNumber}
            {customerName && ` to ${customerName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Channel selector */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Send via</Label>
            <Tabs value={channel} onValueChange={(v) => setChannel(v as "email" | "whatsapp")}>
              <TabsList className="w-full">
                <TabsTrigger value="email" className="flex-1 gap-2" disabled={!canSendEmail}>
                  <Mail className="h-4 w-4" />
                  Email
                  {!canSendEmail && <span className="text-xs text-muted-foreground ml-1">(no email)</span>}
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="flex-1 gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  WhatsApp
                  {!customerPhone && <span className="text-xs text-muted-foreground ml-1">(no phone)</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Recipient info */}
          {channel === "email" ? (
            canSendEmail ? (
              <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded-md">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Sending to:</span>
                <span className="font-medium">{customerEmail}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>No email address on file for this customer.</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 text-sm bg-green-50 border border-green-200 px-3 py-2 rounded-md">
              <MessageCircle className="h-4 w-4 text-green-600" />
              {customerPhone ? (
                <>
                  <span className="text-muted-foreground">Sending to:</span>
                  <span className="font-medium">{customerPhone}</span>
                </>
              ) : (
                <span className="text-muted-foreground">No phone on file — you can select a contact in WhatsApp.</span>
              )}
            </div>
          )}

          {/* Reminder level */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Reminder level</Label>
            <RadioGroup
              value={selectedLevel}
              onValueChange={(v) => setSelectedLevel(v as "friendly" | "firm" | "final")}
              className="space-y-2"
            >
              {levels.map((level) => {
                const Icon = level.icon;
                return (
                  <div
                    key={level.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedLevel === level.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
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
                      <p className="text-xs text-muted-foreground mt-0.5">{level.description}</p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Message preview (email only) */}
          {channel === "email" && templates.length > 0 && (
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

          {/* WhatsApp note */}
          {channel === "whatsapp" && (
            <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              A signed PDF link (valid 7 days) will be generated and included in the WhatsApp message.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSendDisabled}
            className={channel === "whatsapp" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {channel === "whatsapp" ? "Creating link…" : "Sending…"}
              </>
            ) : channel === "whatsapp" ? (
              <>
                <MessageCircle className="h-4 w-4 mr-2" />
                Open WhatsApp
              </>
            ) : (
              "Send Reminder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
