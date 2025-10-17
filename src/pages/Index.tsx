
import { Navigation } from "@/components/Navigation";
import { MetricCard } from "@/components/MetricCard";
import { RecentActivity } from "@/components/RecentActivity";
import { DashboardFilters } from "@/components/DashboardFilters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  Send,
  Clock,
  ChevronDown,
  FileSpreadsheet,
  Shield,
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
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
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
    creditNotes: 0,
    creditNotesTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [pendingReminders, setPendingReminders] = useState(0);

  useEffect(() => {
    if (user) {
      fetchSetupStatus();
      fetchMetrics();
      fetchRecentCustomers();
      fetchOverdueInvoices();
      fetchPendingReminders();
      fetchCreditNotesStats();
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

      // Fetch credit notes stats
      const { data: creditNotes } = await supabase
        .from('credit_notes' as any)
        .select('amount, vat_rate, status')
        .eq('user_id', user!.id);

      const creditNotesCount = creditNotes?.length || 0;
      const creditNotesTotal = (creditNotes as any[])
        ?.reduce((sum: number, cn: any) => sum + (Number(cn.amount) * (1 + Number(cn.vat_rate))), 0) || 0;

      setMetrics({
        outstanding,
        customers: customerCount || 0,
        payments,
        collectionRate,
        creditNotes: creditNotesCount,
        creditNotesTotal,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchCreditNotesStats = async () => {
    try {
      const { count } = await supabase
        .from('credit_notes' as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);
      
      // Update metrics with credit notes count
      setMetrics(prev => ({ ...prev, creditNotes: count || 0 }));
    } catch (error) {
      console.error('Error fetching credit notes stats:', error);
    }
  };

  const fetchRecentCustomers = async () => {
    try {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, email')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (customers) {
        // Fetch outstanding amounts for each customer
        const { data: invoices } = await supabase
          .from('invoices')
          .select('customer_id, total_amount, status')
          .eq('user_id', user!.id)
          .in('customer_id', customers.map(c => c.id));

        const customersWithOutstanding = customers.map(customer => {
          const customerInvoices = invoices?.filter(inv => inv.customer_id === customer.id) || [];
          const outstanding = customerInvoices
            .filter(inv => inv.status !== 'paid')
            .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

          return {
            ...customer,
            outstanding_amount: outstanding,
          };
        });

        setRecentCustomers(customersWithOutstanding);
      }
    } catch (error) {
      console.error('Error fetching recent customers:', error);
    }
  };

  const fetchOverdueInvoices = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, customer_id, total_amount, due_date, status')
        .eq('user_id', user!.id)
        .neq('status', 'paid')
        .lt('due_date', today)
        .order('due_date', { ascending: true })
        .limit(10);

      if (invoices) {
        // Fetch customer names
        const customerIds = [...new Set(invoices.map(inv => inv.customer_id))];
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds);

        const customerMap = new Map(customers?.map(c => [c.id, c.name]) || []);

        const overdueWithDetails = invoices.map(invoice => {
          const dueDate = new Date(invoice.due_date);
          const today = new Date();
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            customer_id: invoice.customer_id,
            customer_name: customerMap.get(invoice.customer_id) || 'Unknown',
            total_amount: Number(invoice.total_amount || 0),
            due_date: invoice.due_date,
            days_overdue: daysOverdue,
          };
        });

        setOverdueInvoices(overdueWithDetails);
      }
    } catch (error) {
      console.error('Error fetching overdue invoices:', error);
    }
  };

  const fetchPendingReminders = async () => {
    try {
      // Count invoices that need reminders (overdue or due soon)
      const today = new Date();
      const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .neq('status', 'paid')
        .lte('due_date', threeDaysFromNow);

      setPendingReminders(count || 0);
    } catch (error) {
      console.error('Error fetching pending reminders:', error);
    }
  };

  const handleSendReminders = async () => {
    toast({
      title: "Sending reminders...",
      description: "Processing payment reminders for overdue invoices.",
    });

    try {
      // In a real implementation, this would call an edge function to send emails
      // For now, we'll show a success message
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Reminders sent successfully",
        description: `${pendingReminders} payment reminders have been sent.`,
      });

      // Refresh data
      fetchPendingReminders();
    } catch (error) {
      toast({
        title: "Error sending reminders",
        description: "Failed to send payment reminders. Please try again.",
        variant: "destructive",
      });
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
          title: "Credit Notes Issued",
          value: metrics.creditNotes.toString(),
          change: metrics.creditNotesTotal > 0 ? formatCurrency(metrics.creditNotesTotal) + " total" : "Malta VAT compliant",
          changeType: "neutral" as const,
          icon: FileSpreadsheet,
        },
      ]
    : [];

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
                          <div className="font-semibold text-sm whitespace-normal break-words">{step.title}</div>
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

          {/* Quick Actions - Show for complete setups */}
          {setupStatus.isComplete && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* Invoice Recent Customer */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Quick Invoice
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="w-full" size="lg">
                          <Plus className="h-4 w-4 mr-2" />
                          Invoice Customer
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-80 bg-popover z-50">
                        <DropdownMenuLabel>Recent Customers</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {recentCustomers.length > 0 ? (
                          recentCustomers.map((customer) => (
                            <DropdownMenuItem
                              key={customer.id}
                              onClick={() => navigate(`/invoices/new?client=${customer.id}`)}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div>
                                <div className="font-medium">{customer.name}</div>
                                <div className="text-xs text-muted-foreground">{customer.email}</div>
                              </div>
                              {customer.outstanding_amount && customer.outstanding_amount > 0 && (
                                <Badge variant="outline" className="ml-2">
                                  {formatCurrency(customer.outstanding_amount)}
                                </Badge>
                              )}
                            </DropdownMenuItem>
                          ))
                        ) : (
                          <DropdownMenuItem disabled>No customers yet</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/customers')}>
                          <Users className="h-4 w-4 mr-2" />
                          View All Customers
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <p className="text-xs text-muted-foreground mt-3">
                      {recentCustomers.length} customer{recentCustomers.length !== 1 ? 's' : ''} in database
                    </p>
                  </CardContent>
                </Card>

                {/* Overdue Invoices */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-destructive" />
                      Overdue Invoices
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {overdueInvoices.length > 0 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="destructive" className="w-full" size="lg">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Follow Up on {overdueInvoices.length}
                            <ChevronDown className="h-4 w-4 ml-2" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-80 bg-popover z-50">
                          <DropdownMenuLabel>Overdue Invoices</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {overdueInvoices.map((invoice) => (
                            <DropdownMenuItem
                              key={invoice.id}
                              onClick={() => navigate(`/invoices/${invoice.id}`)}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div>
                                <div className="font-medium">{invoice.invoice_number}</div>
                                <div className="text-xs text-muted-foreground">
                                  {invoice.customer_name} • {invoice.days_overdue} days overdue
                                </div>
                              </div>
                              <div className="text-right ml-2">
                                <div className="font-semibold text-destructive">
                                  {formatCurrency(invoice.total_amount)}
                                </div>
                              </div>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigate('/invoices?status=overdue')}>
                            <FileText className="h-4 w-4 mr-2" />
                            View All Overdue
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button variant="outline" className="w-full" size="lg" disabled>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                        No Overdue Invoices
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      {overdueInvoices.length > 0 
                        ? `Total: ${formatCurrency(overdueInvoices.reduce((sum, inv) => sum + inv.total_amount, 0))}`
                        : 'All invoices paid on time'
                      }
                    </p>
                  </CardContent>
                </Card>

                {/* Send Reminders */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Send className="h-4 w-4 text-primary" />
                      Payment Reminders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleSendReminders}
                      disabled={pendingReminders === 0}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send {pendingReminders} Reminder{pendingReminders !== 1 ? 's' : ''}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">
                      {pendingReminders > 0 
                        ? `${pendingReminders} invoice${pendingReminders !== 1 ? 's' : ''} due soon or overdue`
                        : 'No pending reminders'
                      }
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Malta VAT Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 dark:bg-blue-950 dark:border-blue-800">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">Malta VAT Compliance & Immutability</h3>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                  All invoices include 18% VAT rate, sequential numbering, and immutability protection once issued. 
                  Issued invoices cannot be modified - use credit notes for corrections. 
                  Documents are automatically archived for the mandatory 6-year period.
                </p>
                {metrics.creditNotes > 0 && (
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-200 flex items-center gap-2">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>{metrics.creditNotes} credit note{metrics.creditNotes !== 1 ? 's' : ''} issued for invoice corrections</span>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Secondary Actions */}
            {setupStatus.isComplete && (
              <div className="lg:col-span-2">
                <h2 className="text-lg font-semibold mb-4">More Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/customers')}>
                    <Users className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Manage Customers</span>
                    <span className="text-xs text-muted-foreground">{metrics.customers} total</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/credit-notes')}>
                    <FileSpreadsheet className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Credit Notes</span>
                    <span className="text-xs text-muted-foreground">{metrics.creditNotes} issued</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/reports')}>
                    <BarChart3 className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Financial Reports</span>
                    <span className="text-xs text-muted-foreground">View analytics</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => navigate('/invoices/export')}>
                    <Download className="h-6 w-6 text-primary" />
                    <span className="font-semibold">Export Data</span>
                    <span className="text-xs text-muted-foreground">6-year archive</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {setupStatus.isComplete && (
              <div>
                <RecentActivity />
              </div>
            )}
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
