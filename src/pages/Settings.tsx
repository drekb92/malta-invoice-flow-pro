import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Settings as SettingsIcon, 
  Save, 
  Building, 
  CreditCard, 
  Bell, 
  Palette, 
  Shield,
  Phone,
  Mail,
  MapPin
} from "lucide-react";

// TypeScript interfaces
interface CompanySettings {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  taxId: string;
  registrationNumber: string;
  logo: string;
}

interface BankingSettings {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  iban: string;
  branch: string;
}

interface InvoiceSettings {
  prefix: string;
  nextNumber: number;
  defaultCurrency: string;
  defaultPaymentTerms: number;
  defaultTaxRate: number;
  footer: string;
  notes: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  invoiceCreated: boolean;
  invoicePaid: boolean;
  invoiceOverdue: boolean;
  paymentReceived: boolean;
  reminderDays: number;
}

interface PreferenceSettings {
  theme: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
}

const Settings = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // State management for all settings categories
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    taxId: "",
    registrationNumber: "",
    logo: "",
  });

  const [bankingSettings, setBankingSettings] = useState<BankingSettings>({
    bankName: "",
    accountName: "",
    accountNumber: "",
    routingNumber: "",
    swiftCode: "",
    iban: "",
    branch: "",
  });

  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
    prefix: "INV",
    nextNumber: 1001,
    defaultCurrency: "USD",
    defaultPaymentTerms: 30,
    defaultTaxRate: 0,
    footer: "",
    notes: "",
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    invoiceCreated: true,
    invoicePaid: true,
    invoiceOverdue: true,
    paymentReceived: true,
    reminderDays: 7,
  });

  const [preferenceSettings, setPreferenceSettings] = useState<PreferenceSettings>({
    theme: "system",
    language: "en",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    numberFormat: "1,234.56",
  });

  const handleSaveCompany = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement save to Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Success",
        description: "Company settings saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save company settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBanking = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement save to Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Success",
        description: "Banking settings saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save banking settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveInvoice = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement save to Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Success",
        description: "Invoice settings saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save invoice settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement save to Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Success",
        description: "Notification settings saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save notification settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement save to Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Success",
        description: "Preferences saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your company information, banking, and application preferences
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Tabs defaultValue="company" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="company" className="gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">Company</span>
              </TabsTrigger>
              <TabsTrigger value="banking" className="gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Banking</span>
              </TabsTrigger>
              <TabsTrigger value="invoice" className="gap-2">
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Invoice</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Preferences</span>
              </TabsTrigger>
            </TabsList>

            {/* Company Tab */}
            <TabsContent value="company">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Company Information
                  </CardTitle>
                  <CardDescription>
                    Manage your business details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Company tab content placeholder */}
                  <div className="text-muted-foreground">
                    Company settings form will be implemented here
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSaveCompany} disabled={isLoading}>
                      <Save className="mr-2 h-4 w-4" />
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Banking Tab */}
            <TabsContent value="banking">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Banking Details
                  </CardTitle>
                  <CardDescription>
                    Configure your bank account information for invoices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Banking tab content placeholder */}
                  <div className="text-muted-foreground">
                    Banking settings form will be implemented here
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSaveBanking} disabled={isLoading}>
                      <Save className="mr-2 h-4 w-4" />
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoice Settings Tab */}
            <TabsContent value="invoice">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Invoice Settings
                  </CardTitle>
                  <CardDescription>
                    Customize invoice defaults and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Invoice settings tab content placeholder */}
                  <div className="text-muted-foreground">
                    Invoice settings form will be implemented here
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSaveInvoice} disabled={isLoading}>
                      <Save className="mr-2 h-4 w-4" />
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Control how and when you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Notifications tab content placeholder */}
                  <div className="text-muted-foreground">
                    Notification settings form will be implemented here
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSaveNotifications} disabled={isLoading}>
                      <Save className="mr-2 h-4 w-4" />
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Application Preferences
                  </CardTitle>
                  <CardDescription>
                    Customize your application experience
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Preferences tab content placeholder */}
                  <div className="text-muted-foreground">
                    Preferences form will be implemented here
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSavePreferences} disabled={isLoading}>
                      <Save className="mr-2 h-4 w-4" />
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Settings;
