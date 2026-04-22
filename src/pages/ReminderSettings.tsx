import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Mail,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  Zap,
  MousePointer,
  Bell,
  TrendingUp,
  Euro,
  Loader2,
  MessageCircle,
  ExternalLink,
  History,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useReminders } from "@/hooks/useReminders";
import { formatDistanceToNow, format } from "date-fns";
import { Link } from "react-router-dom";

interface ReminderSettings {
  id?: string;
  email_reminders_enabled: boolean;
  days_before_due: number;
  send_on_due_date: boolean;
  days_after_due_first: number;
  days_after_due_second: number;
  days_after_due_final: number;
  max_reminders: number;
  stop_after_payment: boolean;
  reminder_frequency: string;
  reminder_mode: "automatic" | "manual";
}

interface ReminderTemplate {
  id: string;
  level: "friendly" | "firm" | "final";
  subject: string;
  body: string;
}

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  due_date: string;
  days_overdue: number;
  last_reminded_at: string | null;
}

interface ActivityLog {
  id: string;
  invoice_id: string;
  invoice_number?: string;
  customer_name?: string;
  reminder_level: "friendly" | "firm" | "final";
  sent_at: string;
  email_sent: boolean;
}

const ReminderSettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendReminder, sending } = useReminders();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [settings, setSettings] = useState<ReminderSettings>({
    email_reminders_enabled: true,
    days_before_due: 3,
    send_on_due_date: true,
    days_after_due_first: 7,
    days_after_due_second: 14,
    days_after_due_final: 21,
    max_reminders: 5,
    stop_after_payment: true,
    reminder_frequency: "weekly",
    reminder_mode: "manual",
  });

  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("reminder_settings")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings({
          ...data,
          reminder_mode: (data.reminder_mode as "automatic" | "manual") || "manual",
        });
      }
    } catch (error) {
      console.error("Error loading reminder settings:", error);
      toast({ title: "Error", description: "Failed to load reminder settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const loadTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("reminder_templates")
        .select("*")
        .eq("user_id", user?.id)
        .order("level", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return;

      // Auto-upgrade stale default templates (those that still have old copy)
      const upgrades: Array<{ id: string; subject: string; body: string }> = [];

      const newDefaults: Record<string, { subject: string; body: string }> = {
        friendly: {
          subject: "Invoice {invoice_number} \u2013 Payment Due {due_date}",
          body: "Dear {customer_name},\n\nThis is a courtesy reminder that Invoice {invoice_number} for {amount} is due on {due_date}.\n\nIf you have already arranged payment, thank you \u2014 please disregard this message.\n\nShould you have any questions, please do not hesitate to get in touch.\n\nKind regards,\n{company_name}\n{company_phone}\n{company_email}",
        },
        firm: {
          subject: "Invoice {invoice_number} \u2013 Payment Overdue",
          body: "Dear {customer_name},\n\nWe are writing to notify you that Invoice {invoice_number} for {amount}, due on {due_date}, is now {days_overdue} days overdue.\n\nDespite our earlier reminder, this invoice remains outstanding. We kindly ask that you arrange payment without further delay.\n\nIf you are experiencing difficulties or have a query regarding this invoice, please contact us as soon as possible so that we can assist.\n\nWe look forward to your prompt response.\n\nKind regards,\n{company_name}\n{company_phone}\n{company_email}",
        },
        final: {
          subject: "Final Notice: Invoice {invoice_number} \u2013 Immediate Payment Required",
          body: "Dear {customer_name},\n\nThis is a formal final notice regarding Invoice {invoice_number} for {amount}, which was due on {due_date} and remains unpaid after {days_overdue} days.\n\nNotwithstanding our previous correspondence, full payment has not been received. You are hereby required to settle this balance within 5 business days of this notice.\n\nFailure to do so may result in the following:\n\n\u2022 Statutory late payment interest at 8 percentage points above the European Central Bank reference rate, in accordance with EU Directive 2011/7/EU as transposed into Maltese law\n\u2022 Referral to a debt collection agency\n\u2022 Legal proceedings to recover the outstanding amount, court costs, and any associated expenses\n\nIf payment has already been made, please send confirmation to {company_email} immediately.\n\nThis letter constitutes formal notice of the outstanding debt and may be presented as evidence of demand in any subsequent legal proceedings.\n\nYours faithfully,\n{company_name}\n{company_phone}\n{company_email}",
        },
      };

      // Old subject fingerprints that indicate an un-customised default
      const oldSubjects: Record<string, string[]> = {
        friendly: ["Friendly Reminder: Invoice {invoice_number} Payment Due"],
        firm: ["Payment Reminder: Invoice {invoice_number} Now Overdue"],
        final: ["FINAL NOTICE: Immediate Payment Required - Invoice {invoice_number}"],
      };

      for (const t of data) {
        const level = t.level as string;
        if (
          t.is_default &&
          newDefaults[level] &&
          oldSubjects[level]?.includes(t.subject)
        ) {
          upgrades.push({ id: t.id, ...newDefaults[level] });
        }
      }

      if (upgrades.length > 0) {
        await Promise.all(
          upgrades.map(({ id, subject, body }) =>
            supabase
              .from("reminder_templates")
              .update({ subject, body })
              .eq("id", id)
          )
        );
        // Reload after upgrade
        const { data: fresh } = await supabase
          .from("reminder_templates")
          .select("*")
          .eq("user_id", user?.id)
          .order("level", { ascending: true });
        if (fresh) setTemplates(fresh);
      } else {
        setTemplates(data);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  }, [user]);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    setOverviewLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Overdue unpaid invoices with customer names
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_id, total_amount, due_date, status")
        .eq("user_id", user.id)
        .not("status", "in", "(paid,draft,cancelled)")
        .lt("due_date", today.toISOString().split("T")[0])
        .order("due_date", { ascending: true });

      if (invoices && invoices.length > 0) {
        const customerIds = [...new Set(invoices.map((i) => i.customer_id))];
        const { data: customers } = await supabase
          .from("customers")
          .select("id, name")
          .in("id", customerIds);

        const customerMap: Record<string, string> = {};
        customers?.forEach((c) => { customerMap[c.id] = c.name; });

        // Get last reminder for each invoice
        const invoiceIds = invoices.map((i) => i.id);
        const { data: logs } = await supabase
          .from("reminder_logs")
          .select("invoice_id, sent_at")
          .in("invoice_id", invoiceIds)
          .eq("email_sent", true)
          .order("sent_at", { ascending: false });

        const lastReminderMap: Record<string, string> = {};
        logs?.forEach((log) => {
          if (!lastReminderMap[log.invoice_id]) {
            lastReminderMap[log.invoice_id] = log.sent_at;
          }
        });

        const overdueList: OverdueInvoice[] = invoices.map((inv) => {
          const due = new Date(inv.due_date);
          due.setHours(0, 0, 0, 0);
          const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            customer_name: customerMap[inv.customer_id] || "Unknown",
            total_amount: Number(inv.total_amount),
            due_date: inv.due_date,
            days_overdue: daysOverdue,
            last_reminded_at: lastReminderMap[inv.id] || null,
          };
        });

        // Sort most overdue first
        overdueList.sort((a, b) => b.days_overdue - a.days_overdue);
        setOverdueInvoices(overdueList);
      } else {
        setOverdueInvoices([]);
      }

      // Global activity log — last 25 reminders
      const { data: recentLogs } = await supabase
        .from("reminder_logs")
        .select("id, invoice_id, reminder_level, sent_at, email_sent")
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(25);

      if (recentLogs && recentLogs.length > 0) {
        // Fetch invoice numbers for these log entries
        const logInvoiceIds = [...new Set(recentLogs.map((l) => l.invoice_id))];
        const { data: logInvoices } = await supabase
          .from("invoices")
          .select("id, invoice_number, customer_id")
          .in("id", logInvoiceIds);

        const logCustomerIds = [...new Set((logInvoices || []).map((i) => i.customer_id))];
        const { data: logCustomers } = logCustomerIds.length > 0
          ? await supabase.from("customers").select("id, name").in("id", logCustomerIds)
          : { data: [] };

        const invMap: Record<string, { invoice_number: string; customer_id: string }> = {};
        logInvoices?.forEach((i) => { invMap[i.id] = i; });

        const custMap: Record<string, string> = {};
        logCustomers?.forEach((c) => { custMap[c.id] = c.name; });

        const enrichedLogs: ActivityLog[] = recentLogs.map((log) => {
          const inv = invMap[log.invoice_id];
          return {
            id: log.id,
            invoice_id: log.invoice_id,
            invoice_number: inv?.invoice_number,
            customer_name: inv ? custMap[inv.customer_id] : undefined,
            reminder_level: log.reminder_level as "friendly" | "firm" | "final",
            sent_at: log.sent_at,
            email_sent: log.email_sent,
          };
        });

        setActivityLog(enrichedLogs);
      } else {
        setActivityLog([]);
      }
    } catch (error) {
      console.error("Error loading overview:", error);
    } finally {
      setOverviewLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSettings();
      loadTemplates();
      loadOverview();
    }
  }, [user, loadSettings, loadTemplates, loadOverview]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("reminder_settings")
        .upsert({ ...settings, user_id: user?.id });

      if (error) throw error;

      toast({ title: "Settings Saved", description: "Your reminder settings have been updated." });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Error", description: "Failed to save reminder settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async (template: ReminderTemplate) => {
    try {
      const { error } = await supabase
        .from("reminder_templates")
        .update({ subject: template.subject, body: template.body })
        .eq("id", template.id);

      if (error) throw error;

      toast({ title: "Template Saved", description: `${template.level} template updated.` });
      loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    }
  };

  const handleSendNow = async (invoice: OverdueInvoice) => {
    setSendingId(invoice.id);
    let level: "friendly" | "firm" | "final" = "friendly";
    if (invoice.days_overdue >= settings.days_after_due_final) level = "final";
    else if (invoice.days_overdue >= settings.days_after_due_second) level = "firm";
    else if (invoice.days_overdue >= settings.days_after_due_first) level = "firm";

    const result = await sendReminder(invoice.id, level);
    if (result.success) {
      await loadOverview();
    }
    setSendingId(null);
  };

  const updateSetting = (key: keyof ReminderSettings, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateTemplate = (id: string, field: "subject" | "body", value: string) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const getLevelBadge = (level: string) => {
    const badges = {
      friendly: { label: "Friendly", variant: "outline" as const, color: "text-blue-600" },
      firm: { label: "Firm", variant: "secondary" as const, color: "text-amber-600" },
      final: { label: "Final Notice", variant: "destructive" as const, color: "text-red-600" },
    };
    return badges[level as keyof typeof badges] || badges.friendly;
  };

  const getRecommendedLevel = (daysOverdue: number): "friendly" | "firm" | "final" => {
    if (daysOverdue >= settings.days_after_due_final) return "final";
    if (daysOverdue >= settings.days_after_due_second) return "firm";
    if (daysOverdue >= settings.days_after_due_first) return "firm";
    return "friendly";
  };

  const totalAtRisk = overdueInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const remindedThisMonth = activityLog.filter((log) => {
    const d = new Date(log.sent_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && log.email_sent;
  }).length;

  // Three-day cooldown check
  const needsReminderNow = overdueInvoices.filter((inv) => {
    if (!inv.last_reminded_at) return true;
    const daysSince = Math.floor(
      (Date.now() - new Date(inv.last_reminded_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince >= 3;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="md:ml-64 p-6">
          <p className="text-muted-foreground">Loading reminder settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Payment Reminders</h1>
              <p className="text-muted-foreground text-sm">
                Monitor overdue invoices and configure automated reminders
              </p>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="overview" className="gap-2">
                <Bell className="h-4 w-4" />
                Overview
                {needsReminderNow.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                    {needsReminderNow.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <Clock className="h-4 w-4" />
                Schedule
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <Mail className="h-4 w-4" />
                Templates
              </TabsTrigger>
            </TabsList>

            {/* ── Overview tab ─────────────────────────────────────────────── */}
            <TabsContent value="overview" className="space-y-6">
              {overviewLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                            <Bell className="h-4 w-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{needsReminderNow.length}</p>
                            <p className="text-xs text-muted-foreground">Need reminder now</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                            <Euro className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">
                              €{totalAtRisk.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground">Total overdue value</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{remindedThisMonth}</p>
                            <p className="text-xs text-muted-foreground">Reminders sent this month</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Overdue invoices needing reminders */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="h-4 w-4 text-orange-500" />
                        Invoices Needing Reminders
                      </CardTitle>
                      <CardDescription>
                        Overdue invoices where no reminder has been sent in the last 3 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {needsReminderNow.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
                          <p className="font-medium">All caught up!</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            No overdue invoices need a reminder right now.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {needsReminderNow.map((inv) => {
                            const level = getRecommendedLevel(inv.days_overdue);
                            const badge = getLevelBadge(level);
                            const isSending = sending && sendingId === inv.id;
                            return (
                              <div
                                key={inv.id}
                                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Link
                                      to={`/invoices/${inv.id}`}
                                      className="font-semibold text-sm hover:underline"
                                    >
                                      {inv.invoice_number}
                                    </Link>
                                    <Badge
                                      variant={inv.days_overdue >= 14 ? "destructive" : inv.days_overdue >= 7 ? "secondary" : "outline"}
                                      className="text-xs"
                                    >
                                      {inv.days_overdue}d overdue
                                    </Badge>
                                    <Badge variant={badge.variant} className="text-xs">
                                      → {badge.label}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                    <span>{inv.customer_name}</span>
                                    <span>·</span>
                                    <span>€{inv.total_amount.toFixed(2)}</span>
                                    {inv.last_reminded_at && (
                                      <>
                                        <span>·</span>
                                        <Clock className="h-3 w-3" />
                                        <span>
                                          Last reminded{" "}
                                          {formatDistanceToNow(new Date(inv.last_reminded_at), { addSuffix: true })}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Button
                                    size="sm"
                                    className="h-7 px-3 text-xs"
                                    onClick={() => handleSendNow(inv)}
                                    disabled={isSending}
                                  >
                                    {isSending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Send className="h-3 w-3 mr-1" />
                                        Send {badge.label}
                                      </>
                                    )}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                                    <Link to={`/invoices/${inv.id}`}>
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* All overdue (already reminded recently) */}
                  {overdueInvoices.length > needsReminderNow.length && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Recently Reminded
                        </CardTitle>
                        <CardDescription>
                          Overdue invoices where a reminder was sent within the last 3 days
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {overdueInvoices
                            .filter((inv) => {
                              if (!inv.last_reminded_at) return false;
                              const daysSince = Math.floor(
                                (Date.now() - new Date(inv.last_reminded_at).getTime()) / (1000 * 60 * 60 * 24)
                              );
                              return daysSince < 3;
                            })
                            .map((inv) => (
                              <div
                                key={inv.id}
                                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20"
                              >
                                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Link
                                      to={`/invoices/${inv.id}`}
                                      className="font-semibold text-sm hover:underline"
                                    >
                                      {inv.invoice_number}
                                    </Link>
                                    <Badge variant="outline" className="text-xs">{inv.days_overdue}d overdue</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {inv.customer_name} · €{inv.total_amount.toFixed(2)} · Reminded{" "}
                                    {inv.last_reminded_at
                                      ? formatDistanceToNow(new Date(inv.last_reminded_at), { addSuffix: true })
                                      : "recently"}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Activity log */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Recent Activity
                      </CardTitle>
                      <CardDescription>Last 25 reminders sent across all invoices</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {activityLog.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No reminders sent yet.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {activityLog.map((log) => {
                            const badge = getLevelBadge(log.reminder_level);
                            return (
                              <div
                                key={log.id}
                                className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/30 transition-colors"
                              >
                                <div
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    log.email_sent ? "bg-green-500" : "bg-red-400"
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm">
                                    <Badge variant={badge.variant} className="text-[10px] mr-2">
                                      {badge.label}
                                    </Badge>
                                    {log.invoice_number && (
                                      <Link
                                        to={`/invoices/${log.invoice_id}`}
                                        className="font-medium hover:underline mr-1"
                                      >
                                        {log.invoice_number}
                                      </Link>
                                    )}
                                    {log.customer_name && (
                                      <span className="text-muted-foreground text-xs">
                                        → {log.customer_name}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {format(new Date(log.sent_at), "d MMM yyyy, HH:mm")}
                                </span>
                                {!log.email_sent && (
                                  <Badge variant="destructive" className="text-[10px] shrink-0">
                                    Failed
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ── Schedule tab ─────────────────────────────────────────────── */}
            <TabsContent value="schedule" className="space-y-6">
              <div className="max-w-3xl space-y-6">
                {/* Mode */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      Reminder Mode
                    </CardTitle>
                    <CardDescription>Choose how payment reminders are triggered</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={settings.reminder_mode}
                      onValueChange={(value: "automatic" | "manual") =>
                        updateSetting("reminder_mode", value)
                      }
                      className="space-y-4"
                    >
                      <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                        <RadioGroupItem value="manual" id="manual" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="manual" className="flex items-center gap-2 font-medium cursor-pointer">
                            <MousePointer className="h-4 w-4 text-blue-600" />
                            Manual with Smart Prompts
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            When viewing overdue invoices you'll see prompts suggesting when to send
                            reminders. Click to send with one tap — you stay in control.
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">Recommended</Badge>
                      </div>

                      <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                        <RadioGroupItem value="automatic" id="automatic" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="automatic" className="flex items-center gap-2 font-medium cursor-pointer">
                            <Zap className="h-4 w-4 text-amber-600" />
                            Fully Automatic
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            System automatically sends reminders based on your schedule below.
                            Emails are sent daily at 9 AM Malta time.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* Schedule */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Reminder Schedule
                    </CardTitle>
                    <CardDescription>
                      Configure when reminders are sent relative to the invoice due date
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Enable Email Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          {settings.reminder_mode === "automatic"
                            ? "Automatically send payment reminders to customers"
                            : "Show reminder prompts on overdue invoice pages"}
                        </p>
                      </div>
                      <Switch
                        checked={settings.email_reminders_enabled}
                        onCheckedChange={(checked) => updateSetting("email_reminders_enabled", checked)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Friendly Reminder</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            value={settings.days_before_due}
                            onChange={(e) => updateSetting("days_before_due", parseInt(e.target.value))}
                            className="w-20"
                            min="0"
                          />
                          <span className="text-sm text-muted-foreground">days before due</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>First Follow-up (Firm)</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            value={settings.days_after_due_first}
                            onChange={(e) => updateSetting("days_after_due_first", parseInt(e.target.value))}
                            className="w-20"
                            min="0"
                          />
                          <span className="text-sm text-muted-foreground">days after due</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Second Follow-up (Firm)</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            value={settings.days_after_due_second}
                            onChange={(e) => updateSetting("days_after_due_second", parseInt(e.target.value))}
                            className="w-20"
                            min="0"
                          />
                          <span className="text-sm text-muted-foreground">days after due</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Final Notice</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            value={settings.days_after_due_final}
                            onChange={(e) => updateSetting("days_after_due_final", parseInt(e.target.value))}
                            className="w-20"
                            min="0"
                          />
                          <span className="text-sm text-muted-foreground">days after due</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Includes late payment interest warnings per Maltese law
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Stop After Payment</Label>
                          <p className="text-sm text-muted-foreground">
                            Stop reminders automatically when invoice is marked paid
                          </p>
                        </div>
                        <Switch
                          checked={settings.stop_after_payment}
                          onCheckedChange={(checked) => updateSetting("stop_after_payment", checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Maximum Reminders</Label>
                          <p className="text-sm text-muted-foreground">
                            Stop sending after this many attempts per invoice
                          </p>
                        </div>
                        <Input
                          type="number"
                          value={settings.max_reminders}
                          onChange={(e) => updateSetting("max_reminders", parseInt(e.target.value))}
                          className="w-20"
                          min="1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving…" : "Save Settings"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ── Templates tab ────────────────────────────────────────────── */}
            <TabsContent value="templates" className="space-y-6">
              <div className="max-w-3xl">
                {templates.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No templates found. Default templates are created automatically on first use.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Email Templates
                      </CardTitle>
                      <CardDescription>
                        Customise email templates for each escalation level
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="friendly" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          {templates.map((template) => {
                            const badge = getLevelBadge(template.level);
                            return (
                              <TabsTrigger key={template.level} value={template.level}>
                                {badge.label}
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>

                        {templates.map((template) => {
                          const badge = getLevelBadge(template.level);
                          return (
                            <TabsContent key={template.level} value={template.level} className="space-y-4 pt-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={badge.variant}>{badge.label}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {template.level === "friendly" && "Polite reminder before/on due date"}
                                  {template.level === "firm" && "Professional but firm tone for overdue payments"}
                                  {template.level === "final" && "Legal language with Malta law references"}
                                </span>
                              </div>

                              <div className="space-y-2">
                                <Label>Email Subject</Label>
                                <Input
                                  value={template.subject}
                                  onChange={(e) => updateTemplate(template.id, "subject", e.target.value)}
                                  placeholder="Subject line…"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Email Body</Label>
                                <Textarea
                                  value={template.body}
                                  onChange={(e) => updateTemplate(template.id, "body", e.target.value)}
                                  className="min-h-64 font-mono text-sm"
                                  placeholder="Email content…"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Variables: {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"},{" "}
                                  {"{due_date}"}, {"{days_overdue}"}, {"{company_name}"},{" "}
                                  {"{company_phone}"}, {"{company_email}"}, {"{payment_terms}"}
                                </p>
                              </div>

                              <Button onClick={() => handleSaveTemplate(template)} variant="outline">
                                <Save className="h-4 w-4 mr-2" />
                                Save Template
                              </Button>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default ReminderSettingsPage;
