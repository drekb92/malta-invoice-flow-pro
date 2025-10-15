
import { Navigation } from "@/components/Navigation";
import { MetricCard } from "@/components/MetricCard";
import { FeatureCard } from "@/components/FeatureCard";
import { RecentActivity } from "@/components/RecentActivity";
import { DashboardFilters } from "@/components/DashboardFilters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import {
  FileText,
  Users,
  CreditCard,
  TrendingUp,
  Plus,
  Download,
  Mail,
  Settings,
  BarChart3,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Building,
  Sparkles,
} from "lucide-react";

interface SetupStatus {
  hasCompanyInfo: boolean;
  hasBankingInfo: boolean;
  hasCustomers: boolean;
  hasInvoices: boolean;
  completionPercentage: number;
  isComplete: boolean;
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({
    hasCompanyInfo: false,
    hasBankingInfo: false,
    hasCustomers: false,
    hasInvoices: false,
    completionPercentage: 0,
    isComplete: false,
  });
  const [metrics, setMetrics] = useState({
    outstanding: 0,
    customers: 0,
    payments: 0,
    collectionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSetupStatus();
      fetchMetrics();
    }
  }, [user]);

  const fetchSetupStatus = async () => {
    try {
      // Check company settings
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('company_name, company_vat_number, company_address')
        .eq('user_id', user!.id)
        .maybeSingle();

      const hasCompanyInfo = !!(
        companyData?.company_name &&
        companyData?.company_vat_number &&
        companyData?.company_address
      );

      // Check banking details
      const { data: bankingData } = await supabase
        .from('banking_details')
        .select('bank_name, bank_iban')
        .eq('user_id', user!.id)
        .maybeSingle();

      const hasBankingInfo = !!(bankingData?.bank_name && bankingData?.bank_iban);

      // Check customers
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);

      const hasCustomers = (customerCount || 0) > 0;

      // Check invoices
      const { count: invoiceCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);

      const hasInvoices = (invoiceCount || 0) > 0;

      // Calculate completion percentage
      const completed = [hasCompanyInfo, hasBankingInfo, hasCustomers, hasInvoices].filter(Boolean).length;
      const completionPercentage = (completed / 4) * 100;
      const isComplete = completionPercentage === 100;

      setSetupStatus({
        hasCompanyInfo,
        hasBankingInfo,
        hasCustomers,
        hasInvoices,
        completionPercentage,
        isComplete,
      });
    } catch (error) {
      console.error('Error fetching setup status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      // Fetch invoice data
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, status')
        .eq('user_id', user!.id);

      const outstanding = invoices
        ?.filter((inv) => inv.status !== 'paid')
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

      const payments = invoices
        ?.filter((inv) => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

      const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;
      const collectionRate = totalInvoiced > 0 ? ((totalInvoiced - outstanding) / totalInvoiced) * 100 : 0;

      // Fetch customer count
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);

      setMetrics({
        outstanding,
        customers: customerCount || 0,
        payments,
        collectionRate,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const setupSteps = [
    {
      title: 'Company Information',
      completed: setupStatus.hasCompanyInfo,
      action: () => navigate('/settings'),
      icon: Building,
      description: 'Add your business details and VAT number',
    },
    {
      title: 'Banking Details',
      completed: setupStatus.hasBankingInfo,
      action: () => navigate('/settings'),
      icon: CreditCard,
      description: 'Configure payment account information',
    },
    {
      title: 'First Customer',
      completed: setupStatus.hasCustomers,
      action: () => navigate('/customers'),
      icon: Users,
      description: 'Add your first customer to the database',
    },
    {
      title: 'First Invoice',
      completed: setupStatus.hasInvoices,
      action: () => navigate('/invoices/new'),
      icon: FileText,
      description: 'Create your first Malta VAT-compliant invoice',
    },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };
  const metricCards = setupStatus.isComplete
    ? [
        {
          title: "Outstanding Invoices",
          value: formatCurrency(metrics.outstanding),
          change: metrics.outstanding > 0 ? "Requires attention" : "All paid",
          changeType: metrics.outstanding > 0 ? ("neutral" as const) : ("positive" as const),
          icon: FileText,
        },
        {
          title: "Active Customers",
          value: metrics.customers.toString(),
          change: metrics.customers > 0 ? "Total in database" : "No customers yet",
          changeType: "neutral" as const,
          icon: Users,
        },
        {
          title: "Total Collected",
          value: formatCurrency(metrics.payments),
          change: "Year to date",
          changeType: "positive" as const,
          icon: CreditCard,
        },
        {
          title: "Collection Rate",
          value: `${metrics.collectionRate.toFixed(1)}%`,
          change: metrics.collectionRate >= 90 ? "Excellent" : "Needs improvement",
          changeType: metrics.collectionRate >= 90 ? ("positive" as const) : ("neutral" as const),
          icon: TrendingUp,
        },
      ]
    : [];

  const features = [
    {
      title: "Create Invoice",
      description: "Generate VAT-compliant invoices with Malta tax requirements",
      icon: Plus,
      action: "New Invoice",
      onClick: () => navigate("/invoices/new"),
    },
    {
      title: "Payment Tracking",
      description: "Monitor payment status and send automated reminders",
      icon: CreditCard,
      action: "Track Payments",
      onClick: () => console.log("Track payments"),
    },
    {
      title: "Customer Management",
      description: "Manage your customer database and communication history",
      icon: Users,
      action: "Manage Customers",
      onClick: () => navigate("/customers"),
    },
    {
      title: "Financial Reports",
      description: "Generate receivables and cash flow reports in EUR",
      icon: BarChart3,
      action: "View Reports",
      onClick: () => navigate("/reports"),
    },
    {
      title: "Email Reminders",
      description: "Configure and send automated payment reminder emails",
      icon: Mail,
      action: "Setup Reminders",
      onClick: () => navigate("/reminders"),
    },
    {
      title: "Export Data",
      description: "Download invoices and reports for archiving (6-year Malta requirement)",
      icon: Download,
      action: "Export",
      onClick: () => navigate("/invoices/export"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Main content */}
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
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
          {!setupStatus.isComplete && !loading && (
            <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Welcome! Let's get you set up</CardTitle>
                      <CardDescription>
                        Complete these steps to start managing your Malta VAT-compliant invoices
                      </CardDescription>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/onboarding')} size="lg">
                    Complete Setup
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Setup Progress</span>
                      <span className="text-sm font-semibold text-primary">
                        {setupStatus.completionPercentage.toFixed(0)}% Complete
                      </span>
                    </div>
                    <Progress value={setupStatus.completionPercentage} className="h-2" />
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                    {setupSteps.map((step, index) => (
                      <Button
                        key={index}
                        variant={step.completed ? "outline" : "default"}
                        className="h-auto p-4 flex flex-col items-start gap-2"
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
                        <div className="text-left w-full">
                          <div className="font-semibold text-sm">{step.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">
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
          {!setupStatus.isComplete && !loading && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complete your profile setup to unlock all features and start creating Malta VAT-compliant invoices.
                Click on any incomplete step above to get started.
              </AlertDescription>
            </Alert>
          )}

          {/* Dashboard Filters - Only show if setup complete */}
          {setupStatus.isComplete && <DashboardFilters />}

          {/* Metrics Grid - Only show if setup complete */}
          {setupStatus.isComplete && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {metricCards.map((metric, index) => (
                <MetricCard key={index} {...metric} />
              ))}
            </div>
          )}

          {/* Getting Started Cards - Show if setup incomplete */}
          {!setupStatus.isComplete && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {setupSteps.map((step, index) => (
                <Card
                  key={index}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    step.completed ? 'border-primary/20 bg-primary/5' : 'border-dashed'
                  }`}
                  onClick={step.action}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        step.completed ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        <step.icon className={`w-6 h-6 ${
                          step.completed ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                      </div>
                      {step.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="font-semibold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{step.description}</p>
                    <Button
                      variant={step.completed ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                    >
                      {step.completed ? 'Edit' : 'Start'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Malta VAT Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <h3 className="text-sm font-medium text-blue-900">Malta VAT Compliance</h3>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              All invoices include 18% VAT rate, sequential numbering, and required elements for Malta tax compliance. 
              Documents are automatically archived for the mandatory 6-year period.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Features Grid */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <FeatureCard key={index} {...feature} />
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <RecentActivity />
            </div>
          </div>

          {/* Currency Info */}
          <div className="mt-8 bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Multi-Currency Support</h3>
                <p className="text-sm text-muted-foreground">
                  EUR base currency with live exchange rates
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">€1.00 EUR</p>
                <p className="text-xs text-muted-foreground">Base currency</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
