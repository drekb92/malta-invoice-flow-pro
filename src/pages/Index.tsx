import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { MetricCard } from "@/components/MetricCard";
import { RecentActivity } from "@/components/RecentActivity";
import { DashboardCommandBar, NewButton } from "@/components/DashboardCommandBar";
import { ReceivablesAgingCard } from "@/components/ReceivablesAgingCard";
import { TodaySnapshotCard } from "@/components/TodaySnapshotCard";
import { WorkQueueCard } from "@/components/WorkQueueCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  useSetupStatus,
  useDashboardMetrics,
  useRecentCustomers,
  useOverdueInvoices,
  useInvoicesNeedingSending,
  useTodaySnapshot,
} from "@/hooks/useDashboard";
import { FileText, Users, CreditCard, CheckCircle2, AlertCircle, ArrowRight, Building, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetupStatus {
  hasCompanyInfo: boolean;
  hasBankingInfo: boolean;
  hasCustomers: boolean;
  hasInvoices: boolean;
  completionPercentage: number;
  isComplete: boolean;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  outstanding_amount?: number;
}

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  total_amount: number;
  balance_due: number;
  due_date: string;
  days_overdue: number;
  last_sent_at?: string | null;
  last_sent_channel?: string | null;
  last_reminded_at?: string | null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const defaultSetupStatus: SetupStatus = {
  hasCompanyInfo: false,
  hasBankingInfo: false,
  hasCustomers: false,
  hasInvoices: false,
  completionPercentage: 0,
  isComplete: false,
};

const defaultMetrics = {
  outstanding: 0,
  customers: 0,
  payments: 0,
  collectionRate: 0,
  invoicesCount: 0,
  invoicesTotal: 0,
};

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function KPISkeletonRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="h-[130px]">
          <CardContent className="p-4 h-full flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="w-8 h-8 rounded-md" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-7 w-28 mt-2" />
            <Skeleton className="h-3 w-24 mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Command bar skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-44" />
      </div>

      {/* KPI cards */}
      <KPISkeletonRow />

      {/* Content grid */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-6">
        <div className="col-span-8 grid grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <div className="col-span-4 space-y-6">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-52 rounded-lg" />
        </div>
      </div>

      {/* Mobile content */}
      <div className="lg:hidden space-y-6">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-52 rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getDateRangeLabel(dateRange: string) {
  switch (dateRange) {
    case "7-days":
      return "Last 7 days";
    case "30-days":
      return "Last 30 days";
    case "90-days":
      return "Last 90 days";
    case "12-months":
      return "Last 12 months";
    case "ytd":
      return "Year to date";
    default:
      return "All time";
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  // Filter state — wired into data hooks below
  const [dateRange, setDateRange] = useState("30-days");
  const [customerId, setCustomerId] = useState("all");

  // ── Data hooks ─────────────────────────────────────────────────────────────
  // NOTE: Once you update your lib/dashboard.ts functions to accept dateRange
  // and customerId, add them to the queryKey arrays and pass them into the
  // query functions so results re-fetch automatically when filters change.
  //
  // Example for getDashboardMetrics:
  //   queryKey: ["dashboardMetrics", userId, dateRange, customerId]
  //   queryFn:  () => getDashboardMetrics(userId!, { dateRange, customerId })
  //
  // The hooks are called here so the plumbing is ready — swap in the extended
  // signatures when your backend functions are updated.

  // Build a single filters object — passed into every hook that supports it.
  // React Query's queryKey includes these values, so data re-fetches
  // automatically whenever the user changes a filter.
  const filters = {
    dateRange: dateRange as import("@/lib/dashboard").DateRange,
    customerId,
  };

  const { data: setupData, isLoading: setupLoading } = useSetupStatus(userId);
  const { data: metricsData, isLoading: metricsLoading } = useDashboardMetrics(userId, filters);
  const { data: recentCustomersData } = useRecentCustomers(userId);
  const {
    data: overdueInvoicesData,
    isLoading: overdueLoading,
    refetch: refetchOverdueInvoices,
  } = useOverdueInvoices(userId, filters);
  const { data: needsSendingData, refetch: refetchNeedsSending } = useInvoicesNeedingSending(userId, filters);
  const { data: todaySnapshotData } = useTodaySnapshot(userId);

  // ── Derived values ──────────────────────────────────────────────────────────
  const setupStatus: SetupStatus = setupData ?? defaultSetupStatus;
  const metrics = metricsData ?? defaultMetrics;
  const recentCustomers = (recentCustomersData as Customer[] | undefined) ?? [];
  const overdueInvoices = (overdueInvoicesData as OverdueInvoice[] | undefined) ?? [];
  const needsSendingInvoices = needsSendingData ?? [];
  const todaySnapshot = todaySnapshotData ?? {
    invoicesCreatedToday: 0,
    paymentsReceivedToday: 0,
    amountCollectedToday: 0,
  };

  const completionPercentage = Number(setupStatus?.completionPercentage ?? 0);

  // True while any critical data is still in flight on first load
  const isLoading = setupLoading || metricsLoading || overdueLoading;

  // ── Formatting ──────────────────────────────────────────────────────────────
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);

  // ── Setup steps ─────────────────────────────────────────────────────────────
  const setupSteps = [
    {
      title: "Company Information",
      completed: setupStatus.hasCompanyInfo,
      action: () => navigate("/settings"),
      icon: Building,
      description: "Add your business details and VAT number",
    },
    {
      title: "Banking Details",
      completed: setupStatus.hasBankingInfo,
      action: () => navigate("/settings"),
      icon: CreditCard,
      description: "Configure payment account information",
    },
    {
      title: "First Customer",
      completed: setupStatus.hasCustomers,
      action: () => navigate("/customers"),
      icon: Users,
      description: "Add your first customer to the database",
    },
    {
      title: "First Invoice",
      completed: setupStatus.hasInvoices,
      action: () => navigate("/invoices/new"),
      icon: FileText,
      description: "Create your first Malta VAT-compliant invoice",
    },
  ];

  // ── KPI metric cards ────────────────────────────────────────────────────────
  // changeType drives colour in MetricCard:
  //   "negative" → amber  (outstanding with balance)
  //   "positive" → emerald
  //   "neutral"  → muted
  const dateLabel = getDateRangeLabel(dateRange);

  const metricCards = setupStatus.isComplete
    ? [
        {
          title: "Outstanding",
          value: formatCurrency(metrics.outstanding),
          change: metrics.outstanding > 0 ? "Requires attention" : "All paid up",
          changeType: (metrics.outstanding > 0 ? "negative" : "positive") as "positive" | "negative" | "neutral",
          colorScheme: (metrics.outstanding > 0 ? "amber" : "emerald") as "amber" | "emerald" | "blue" | "slate",
          urgent: metrics.outstanding > 0,
          icon: FileText,
          subtitle: "As of today",
          onClick: () => navigate("/invoices?status=unpaid"),
          viewAllLabel: "View unpaid",
        },
        {
          title: "Customers",
          value: metrics.customers.toString(),
          change: metrics.customers > 0 ? `${metrics.customers} active` : "No customers yet",
          changeType: "neutral" as const,
          colorScheme: "blue" as const,
          icon: Users,
          subtitle: dateLabel,
          onClick: () => navigate("/customers"),
          viewAllLabel: "View all",
        },
        {
          title: "Collected",
          value: formatCurrency(metrics.payments),
          change: metrics.payments > 0 ? "Payments received" : "No payments yet",
          changeType: (metrics.payments > 0 ? "positive" : "neutral") as "positive" | "negative" | "neutral",
          colorScheme: "emerald" as const,
          icon: CreditCard,
          subtitle: dateLabel,
          onClick: () => navigate("/invoices?status=paid"),
          viewAllLabel: "View paid",
        },
        {
          title: "Invoices Issued",
          value: metrics.invoicesCount.toString(),
          change: metrics.invoicesTotal > 0 ? `${formatCurrency(metrics.invoicesTotal)} total` : "No invoices yet",
          changeType: "neutral" as const,
          colorScheme: "slate" as const,
          icon: FileText,
          subtitle: dateLabel,
          onClick: () => navigate("/invoices"),
          viewAllLabel: "View all",
        },
      ]
    : [];

  // ── Dynamic header copy ─────────────────────────────────────────────────────
  const greeting = getGreeting();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? null;
  const greetingText = firstName ? `${greeting}, ${firstName}` : greeting;

  const overdueCount = overdueInvoices.length;
  const needsSendingCount = needsSendingInvoices.length;

  let headerSubtitle = "Welcome to your Malta receivables management system";
  if (setupStatus.isComplete) {
    if (overdueCount > 0 && needsSendingCount > 0) {
      headerSubtitle = `You have ${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""} and ${needsSendingCount} waiting to be sent`;
    } else if (overdueCount > 0) {
      headerSubtitle = `You have ${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""} requiring attention`;
    } else if (needsSendingCount > 0) {
      headerSubtitle = `${needsSendingCount} invoice${needsSendingCount !== 1 ? "s" : ""} ready to send`;
    } else {
      headerSubtitle = "Everything is up to date — great work!";
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="md:ml-64">
        {/* ── Header ── */}
        <header className="bg-card border-b border-border sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{greetingText}</h1>
                <p
                  className={`text-sm mt-0.5 ${
                    overdueCount > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"
                  }`}
                >
                  {isLoading ? <Skeleton className="h-4 w-64 inline-block" /> : headerSubtitle}
                </p>
              </div>

              {/* New button — only shown once setup is complete */}
              {setupStatus.isComplete && !isLoading && (
                <div className="shrink-0">
                  <NewButton />
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* ── Loading state ── */}
          {isLoading && <DashboardSkeleton />}

          {/* ── Setup incomplete view ── */}
          {!isLoading && !setupStatus.isComplete && (
            <>
              {/* Onboarding card */}
              <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Let's get you set up</CardTitle>
                        <CardDescription>
                          Complete these steps to start managing your Malta VAT-compliant invoices
                        </CardDescription>
                      </div>
                    </div>
                    <Button onClick={() => navigate("/onboarding")} size="lg">
                      Complete Setup
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Progress bar */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Setup Progress</span>
                      <span className="text-sm font-semibold text-primary">
                        {completionPercentage.toFixed(0)}% Complete
                      </span>
                    </div>
                    <Progress value={completionPercentage} className="h-2" />
                  </div>

                  {/* Step cards — single canonical rendering */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {setupSteps.map((step, index) => (
                      <Card
                        key={index}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          step.completed ? "border-primary/20 bg-primary/5" : "border-dashed hover:border-primary/40"
                        }`}
                        onClick={step.action}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                step.completed ? "bg-primary/10" : "bg-muted"
                              }`}
                            >
                              <step.icon
                                className={`w-5 h-5 ${step.completed ? "text-primary" : "text-muted-foreground"}`}
                              />
                            </div>
                            {step.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                          <p className="text-xs text-muted-foreground mb-3">{step.description}</p>
                          {step.completed ? (
                            <Badge variant="success" className="text-xs">
                              Complete
                            </Badge>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                step.action();
                              }}
                            >
                              Start
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Alert */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Complete your profile setup to unlock all features and start creating Malta VAT-compliant invoices.
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* ── Complete dashboard view ── */}
          {!isLoading && setupStatus.isComplete && (
            <div className="space-y-6">
              {/* Filters toolbar — changes trigger automatic re-fetches via React Query */}
              <DashboardCommandBar
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                customerId={customerId}
                onCustomerIdChange={setCustomerId}
                customers={recentCustomers.map((c) => ({
                  id: c.id,
                  name: c.name,
                }))}
              />

              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {metricCards.map((metric, index) => (
                  <MetricCard key={index} {...metric} />
                ))}
              </div>

              {/* Mobile layout */}
              <div className="lg:hidden space-y-6">
                <WorkQueueCard
                  overdueInvoices={overdueInvoices}
                  needsSendingInvoices={needsSendingInvoices}
                  formatCurrency={formatCurrency}
                  onReminderSent={() => refetchOverdueInvoices()}
                  onInvoiceSent={() => refetchNeedsSending()}
                />
                <ReceivablesAgingCard overdueInvoices={overdueInvoices} formatCurrency={formatCurrency} />
                <TodaySnapshotCard
                  invoicesCreatedToday={todaySnapshot.invoicesCreatedToday}
                  paymentsReceivedToday={todaySnapshot.paymentsReceivedToday}
                  amountCollectedToday={todaySnapshot.amountCollectedToday}
                  formatCurrency={formatCurrency}
                />
                <RecentActivity userId={userId} />
              </div>

              {/* Desktop layout — 12-column grid */}
              <div className="hidden lg:grid lg:grid-cols-12 gap-6">
                <div className="col-span-8 grid grid-cols-2 gap-6">
                  <WorkQueueCard
                    overdueInvoices={overdueInvoices}
                    needsSendingInvoices={needsSendingInvoices}
                    formatCurrency={formatCurrency}
                    onReminderSent={() => refetchOverdueInvoices()}
                    onInvoiceSent={() => refetchNeedsSending()}
                  />
                  <ReceivablesAgingCard overdueInvoices={overdueInvoices} formatCurrency={formatCurrency} />
                </div>
                <div className="col-span-4 space-y-6">
                  <TodaySnapshotCard
                    invoicesCreatedToday={todaySnapshot.invoicesCreatedToday}
                    paymentsReceivedToday={todaySnapshot.paymentsReceivedToday}
                    amountCollectedToday={todaySnapshot.amountCollectedToday}
                    formatCurrency={formatCurrency}
                  />
                  <RecentActivity userId={userId} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
