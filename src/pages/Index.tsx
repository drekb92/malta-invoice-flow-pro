
import { Navigation } from "@/components/Navigation";
import { MetricCard } from "@/components/MetricCard";
import { FeatureCard } from "@/components/FeatureCard";
import { RecentActivity } from "@/components/RecentActivity";
import { DashboardFilters } from "@/components/DashboardFilters";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const metrics = [
    {
      title: "Outstanding Invoices",
      value: "€24,580",
      change: "+12% from last month",
      changeType: "positive" as const,
      icon: FileText,
    },
    {
      title: "Active Customers",
      value: "48",
      change: "+3 new this month",
      changeType: "positive" as const,
      icon: Users,
    },
    {
      title: "Payments This Month",
      value: "€18,920",
      change: "+8% from last month",
      changeType: "positive" as const,
      icon: CreditCard,
    },
    {
      title: "Collection Rate",
      value: "94.2%",
      change: "+2.1% improvement",
      changeType: "positive" as const,
      icon: TrendingUp,
    },
  ];

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
          {/* Dashboard Filters */}
          <DashboardFilters />

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {metrics.map((metric, index) => (
              <MetricCard key={index} {...metric} />
            ))}
          </div>

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
