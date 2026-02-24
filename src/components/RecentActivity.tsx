import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Users, CreditCard, Mail, Bell, Receipt, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: "invoice" | "payment" | "customer" | "email" | "reminder" | "credit";
  title: string;
  description: string;
  timestamp: Date;
  status: string;
}

const statusColors: Record<string, string> = {
  created: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  issued: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  received: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  new: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  sent: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  reminder: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  credited: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const iconMap = {
  invoice: FileText,
  payment: CreditCard,
  customer: Users,
  email: Mail,
  reminder: Bell,
  credit: Receipt,
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" }).format(amount);

const TAB_FILTERS: Record<string, Activity["type"][]> = {
  all: ["invoice", "payment", "customer", "email", "reminder", "credit"],
  invoices: ["invoice", "credit"],
  payments: ["payment"],
  reminders: ["reminder", "email"],
};

const fetchRecentActivities = async (userId: string): Promise<Activity[]> => {
  const activities: Activity[] = [];

  const [invoicesResult, paymentsResult, customersResult, sendLogsResult, creditNotesResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, issued_at, customers(name)")
      .eq("user_id", userId)
      .eq("is_issued", true)
      .not("issued_at", "is", null)
      .order("issued_at", { ascending: false })
      .limit(5),
    supabase
      .from("payments")
      .select("id, amount, created_at, invoices!payments_invoice_id_fkey(invoice_number, customers(name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("customers")
      .select("id, name, business_name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("document_send_logs")
      .select("id, document_type, document_number, channel, sent_at, success, customers(name)")
      .eq("user_id", userId)
      .eq("success", true)
      .order("sent_at", { ascending: false })
      .limit(5),
    supabase
      .from("credit_notes")
      .select("id, credit_note_number, amount, created_at, customers(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (invoicesResult.data) {
    for (const inv of invoicesResult.data) {
      const customer = inv.customers as { name: string } | null;
      activities.push({
        id: `inv-${inv.id}`,
        type: "invoice",
        title: `Invoice ${inv.invoice_number} issued`,
        description: `${formatCurrency(inv.total_amount || 0)} for ${customer?.name || "Unknown"}`,
        timestamp: new Date(inv.issued_at!),
        status: "issued",
      });
    }
  }

  if (paymentsResult.data) {
    for (const pay of paymentsResult.data) {
      const invoice = pay.invoices as { invoice_number: string; customers: { name: string } | null } | null;
      activities.push({
        id: `pay-${pay.id}`,
        type: "payment",
        title: "Payment received",
        description: `${formatCurrency(pay.amount || 0)} from ${invoice?.customers?.name || "Unknown"}`,
        timestamp: new Date(pay.created_at!),
        status: "received",
      });
    }
  }

  if (customersResult.data) {
    for (const cust of customersResult.data) {
      activities.push({
        id: `cust-${cust.id}`,
        type: "customer",
        title: "New customer added",
        description: cust.business_name || cust.name,
        timestamp: new Date(cust.created_at!),
        status: "new",
      });
    }
  }

  if (sendLogsResult.data) {
    const sendActivities: Activity[] = [];
    for (const log of sendLogsResult.data) {
      const customer = log.customers as { name: string } | null;
      const channelLabel = log.channel === "email" ? "Email" : log.channel === "whatsapp" ? "WhatsApp" : "Document";
      sendActivities.push({
        id: `send-${log.id}`,
        type: "email",
        title: `${channelLabel} sent`,
        description: `${log.document_type} ${log.document_number} to ${customer?.name || "customer"}`,
        timestamp: new Date(log.sent_at!),
        status: "sent",
      });
    }
    // Deduplicate entries for the same document+channel within 60 seconds
    const deduped = sendActivities.filter((activity, index) => {
      if (index === 0) return true;
      const prev = sendActivities[index - 1];
      if (prev.description === activity.description) {
        const diff = Math.abs(prev.timestamp.getTime() - activity.timestamp.getTime());
        if (diff < 60000) return false;
      }
      return true;
    });
    activities.push(...deduped);
  }

  if (creditNotesResult.data) {
    for (const cn of creditNotesResult.data) {
      const customer = cn.customers as { name: string } | null;
      activities.push({
        id: `cn-${cn.id}`,
        type: "credit",
        title: `Credit note ${cn.credit_note_number} issued`,
        description: `${formatCurrency(cn.amount || 0)} for ${customer?.name || "Unknown"}`,
        timestamp: new Date(cn.created_at!),
        status: "credited",
      });
    }
  }

  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 15);
};

function ActivityRow({ activity }: { activity: Activity }) {
  const Icon = iconMap[activity.type];
  return (
    <div className="flex items-center gap-2.5 py-1.5 px-1">
      <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center shrink-0">
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-xs font-medium text-foreground truncate">{activity.title}</p>
          <Badge
            variant="secondary"
            className={`${statusColors[activity.status]} text-[10px] leading-none px-1.5 py-0.5 h-auto shrink-0`}
          >
            {activity.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] text-muted-foreground truncate">{activity.description}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

interface RecentActivityProps {
  userId?: string;
}

export function RecentActivity({ userId }: RecentActivityProps) {
  const [tab, setTab] = useState("all");
  const { data: activities, isLoading } = useQuery({
    queryKey: ["recentActivities", userId],
    queryFn: () => fetchRecentActivities(userId!),
    enabled: !!userId,
  });

  const filtered = activities?.filter((a) => TAB_FILTERS[tab]?.includes(a.type)).slice(0, 5) ?? [];

  if (isLoading) {
    return (
      <Card className="flex flex-col max-h-[360px]">
        <CardHeader className="shrink-0 pb-2">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription className="text-xs">Latest updates</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="w-6 h-6 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col max-h-[360px] overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 shrink-0 px-4 pt-4">
        <div>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </div>
        <Link
          to="/activity"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-1 pb-1 shrink-0">
          <TabsList className="h-7 w-full bg-muted/60">
            <TabsTrigger value="all" className="text-[11px] px-2.5 py-1 h-5 data-[state=active]:shadow-none">All</TabsTrigger>
            <TabsTrigger value="invoices" className="text-[11px] px-2.5 py-1 h-5 data-[state=active]:shadow-none">Invoices</TabsTrigger>
            <TabsTrigger value="payments" className="text-[11px] px-2.5 py-1 h-5 data-[state=active]:shadow-none">Payments</TabsTrigger>
            <TabsTrigger value="reminders" className="text-[11px] px-2.5 py-1 h-5 data-[state=active]:shadow-none">Reminders</TabsTrigger>
          </TabsList>
        </div>

        <CardContent className="flex-1 overflow-auto pt-1 pb-3 px-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No activity yet.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </CardContent>
      </Tabs>
    </Card>
  );
}
