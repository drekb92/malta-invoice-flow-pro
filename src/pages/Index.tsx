import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { MetricCard } from "@/components/MetricCard";
import { RecentActivity } from "@/components/RecentActivity";
import { DashboardCommandBar } from "@/components/DashboardCommandBar";
import { PendingRemindersWidget } from "@/components/PendingRemindersWidget";
import { ReceivablesAgingCard } from "@/components/ReceivablesAgingCard";
import { NeedsSendingCard } from "@/components/NeedsSendingCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  useSetupStatus,
  useDashboardMetrics,
  useRecentCustomers,
  useOverdueInvoices,
  useInvoicesNeedingSending,
} from "@/hooks/useDashboard";
import {
  FileText,
  Users,
  CreditCard,
  Plus,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Building,
  Sparkles,
  Clock,
} from "lucide-react";

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
  due_date: string;
  days_overdue: number;
  last_sent_at?: string | null;
  last_sent_channel?: string | null;
  last_reminded_at?: string | null;
}

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

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const userId = user?.id;

  // Filter state
  const [dateRange, setDateRange] = useState("30-days");
  const [customerId, setCustomerId] = useState("all");

  // === React Query hooks for dashboard data ===
  const {
    data: setupData,
    isLoading: setupLoading,
  } = useSetupStatus(userId);
  const { data: metricsData } = useDashboardMetrics(userId);
  const { data: recentCustomersData } = useRecentCustomers(userId);
  const { data: overdueInvoicesData, refetch: refetchOverdueInvoices } = useOverdueInvoices(userId);
  const { data: needsSendingData, refetch: refetchNeedsSending } = useInvoicesNeedingSending(userId);

  // === Fallbacks / derived values ===
  const setupStatus: SetupStatus = setupData ?? defaultSetupStatus;
  const metrics = metricsData ?? defaultMetrics;
  const recentCustomers =
    (recentCustomersData as Customer[] | undefined) ?? [];
  const overdueInvoices =
    (overdueInvoicesData as OverdueInvoice[] | undefined) ?? [];
  const needsSendingInvoices = needsSendingData ?? [];

  const completionPercentage = Number(
    setupStatus?.completionPercentage ?? 0
  );

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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);

  // Get date range label for helper text
  const getDateRangeLabel = () => {
    switch (dateRange) {
      case "7-days": return "Last 7 days";
      case "30-days": return "Last 30 days";
      case "90-days": return "Last 90 days";
      case "12-months": return "Last 12 months";
      case "ytd": return "Year to date";
      default: return "All time";
    }
  };

  const metricCards =
    setupStatus.isComplete
      ? [
          {
            title: "Outstanding",
            value: formatCurrency(metrics.outstanding),
            change: metrics.outstanding > 0 ? "Requires attention" : "All paid",
            changeType: metrics.outstanding > 0 ? ("neutral" as const) : ("positive" as const),
            icon: FileText,
            onClick: () => navigate("/invoices?status=unpaid"),
            viewAllLabel: "View unpaid",
          },
          {
            title: "Customers",
            value: metrics.customers.toString(),
            change: getDateRangeLabel(),
            changeType: "neutral" as const,
            icon: Users,
            onClick: () => navigate("/customers"),
            viewAllLabel: "View all",
          },
          {
            title: "Collected",
            value: formatCurrency(metrics.payments),
            change: getDateRangeLabel(),
            changeType: "positive" as const,
            icon: CreditCard,
            onClick: () => navigate("/invoices?status=paid"),
            viewAllLabel: "View paid",
          },
          {
            title: "Invoices Issued",
            value: metrics.invoicesCount.toString(),
            change: metrics.invoicesTotal > 0 
              ? `${formatCurrency(metrics.invoicesTotal)} total` 
              : getDateRangeLabel(),
            changeType: "neutral" as const,
            icon: FileText,
            onClick: () => navigate("/invoices"),
            viewAllLabel: "View all",
          },
        ]
      : [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Dashboard
                </h1>
                <p className="text-muted-foreground">
                  Welcome to your Malta receivables management system
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button size="sm" onClick={() => navigate("/invoices/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Setup Progress Card - Only show if not complete */}
          {!setupStatus.isComplete && !setupLoading && (
            <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        Welcome! Let's get you set up
                      </CardTitle>
                      <CardDescription>
                        Complete these steps to start managing your Malta
                        VAT-compliant invoices
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate("/onboarding")}
                    size="lg"
                  >
                    Complete Setup
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        Setup Progress
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        {completionPercentage.toFixed(0)}% Complete
                      </span>
                    </div>
                    <Progress
                      value={completionPercentage}
                      className="h-2"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                    {setupSteps.map((step, index) => (
                      <Button
                        key={index}
                        variant={step.completed ? "outline" : "default"}
                        className="h-auto p-4 flex flex-col items-start gap-2 whitespace-normal"
                        onClick={step.action}
                      >
                        <div className="flex items-center justify-between w-full">
                          <step.icon className="w-5 h-5" />
                          {step.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-left w-full space-y-1">
                          <div className="font-semibold text-sm whitespace-normal break-words">
                            {step.title}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-normal break-words line-clamp-2">
                            {step.description}
                          </div>
                        </div>
                        {step.completed && (
                          <Badge variant="success" className="text-xs">
                            Complete
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Getting Started Alert - Show if setup incomplete */}
          {!setupStatus.isComplete && !setupLoading && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complete your profile setup to unlock all features and start
                creating Malta VAT-compliant invoices. Click on any incomplete
                step above to get started.
              </AlertDescription>
            </Alert>
          )}

          {/* Dashboard Command Bar - Only show if setup complete */}
          {setupStatus.isComplete && (
            <DashboardCommandBar
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              customerId={customerId}
              onCustomerIdChange={setCustomerId}
              customers={recentCustomers.map((c) => ({ id: c.id, name: c.name }))}
            />
          )}

          {/* Metrics Grid - Only show if setup complete */}
          {setupStatus.isComplete && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              {metricCards.map((metric, index) => (
                <MetricCard key={index} {...metric} />
              ))}
            </div>
          )}

          {/* Getting Started Cards - Show if setup incomplete */}
          {!setupStatus.isComplete && !setupLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {setupSteps.map((step, index) => (
                <Card
                  key={index}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    step.completed
                      ? "border-primary/20 bg-primary/5"
                      : "border-dashed"
                  }`}
                  onClick={step.action}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          step.completed ? "bg-primary/10" : "bg-muted"
                        }`}
                      >
                        <step.icon
                          className={`w-6 h-6 ${
                            step.completed
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                      </div>
                      {step.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="font-semibold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {step.description}
                    </p>
                    <Button
                      variant={step.completed ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                    >
                      {step.completed ? "Edit" : "Start"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Quick Actions - Show for complete setups */}
          {setupStatus.isComplete && (
            <>
              {/* Row 1: Primary Actions, Receivables Aging, Needs Sending */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 items-start">
                {/* Primary Actions Card */}
                <Card className="flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      Primary Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button 
                        className="w-full justify-start" 
                        onClick={() => navigate("/invoices/new")}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        New Invoice
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => navigate("/invoices?action=record-payment")}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Record Payment
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => navigate("/quotations/new")}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        New Quotation
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => navigate("/reminders")}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Send Reminders
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Receivables Aging Card */}
                <ReceivablesAgingCard
                  overdueInvoices={overdueInvoices}
                  formatCurrency={formatCurrency}
                />

                {/* Needs Sending Card */}
                <NeedsSendingCard
                  invoices={needsSendingInvoices}
                  formatCurrency={formatCurrency}
                  onSent={() => refetchNeedsSending()}
                />
              </div>

              {/* Row 2: Pending Reminders + Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
                <PendingRemindersWidget
                  overdueInvoices={overdueInvoices}
                  maxDisplay={3}
                  formatCurrency={formatCurrency}
                  onReminderSent={() => refetchOverdueInvoices()}
                />
                <RecentActivity userId={userId} />
              </div>
            </>
          )}


          {/* Currency Info */}
          <div className="mt-8 bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">
                  Multi-Currency Support
                </h3>
                <p className="text-sm text-muted-foreground">
                  EUR base currency with live exchange rates
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">€1.00 EUR</p>
                <p className="text-xs text-muted-foreground">
                  Base currency
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
