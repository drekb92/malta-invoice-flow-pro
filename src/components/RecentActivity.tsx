import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  created: "bg-blue-100 text-blue-800",
  issued: "bg-blue-100 text-blue-800",
  received: "bg-green-100 text-green-800",
  new: "bg-purple-100 text-purple-800",
  sent: "bg-orange-100 text-orange-800",
  reminder: "bg-amber-100 text-amber-800",
  credited: "bg-red-100 text-red-800",
};

const iconMap = {
  invoice: FileText,
  payment: CreditCard,
  customer: Users,
  email: Mail,
  reminder: Bell,
  credit: Receipt,
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

const fetchRecentActivities = async (userId: string): Promise<Activity[]> => {
  const activities: Activity[] = [];

  // Fetch invoices, payments, customers, send logs, and credit notes in parallel
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

  // Transform invoices
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

  // Transform payments
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

  // Transform customers
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

  // Transform send logs (emails/documents)
  if (sendLogsResult.data) {
    for (const log of sendLogsResult.data) {
      const customer = log.customers as { name: string } | null;
      const channelLabel = log.channel === "email" ? "Email" : log.channel === "whatsapp" ? "WhatsApp" : "Document";
      activities.push({
        id: `send-${log.id}`,
        type: "email",
        title: `${channelLabel} sent`,
        description: `${log.document_type} ${log.document_number} to ${customer?.name || "customer"}`,
        timestamp: new Date(log.sent_at!),
        status: "sent",
      });
    }
  }

  // Transform credit notes
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

  // Sort by timestamp descending and take top 5
  return activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);
};

interface RecentActivityProps {
  userId?: string;
}

export function RecentActivity({ userId }: RecentActivityProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["recentActivities", userId],
    queryFn: () => fetchRecentActivities(userId!),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates from your receivables</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start space-x-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates from your receivables</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent activity yet. Start by adding customers or creating invoices.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates from your receivables</CardDescription>
        </div>
        <Link 
          to="/activity" 
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = iconMap[activity.type];
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activity.title}
                    </p>
                    <Badge variant="secondary" className={statusColors[activity.status]}>
                      {activity.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
