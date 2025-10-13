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

interface BankingPreferences {
  includeBankingOnInvoices: boolean;
  bankingDisplayFormat: string;
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

  const [bankingPreferences, setBankingPreferences] = useState<BankingPreferences>({
    includeBankingOnInvoices: true,
    bankingDisplayFormat: "full",
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

  // IBAN validation helper
  const validateIBAN = (iban: string): boolean => {
    // Remove spaces and convert to uppercase
    const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
    
    // Basic IBAN format check (2 letters + 2 digits + up to 30 alphanumeric)
    const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
    return ibanRegex.test(cleanIBAN);
  };

  const handleSaveBanking = async () => {
    // Validate IBAN if provided
    if (bankingSettings.iban && !validateIBAN(bankingSettings.iban)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid IBAN format",
        variant: "destructive",
      });
      return;
    }

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
              <div className="space-y-6">
                {/* Company Information Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Company Information
                    </CardTitle>
                    <CardDescription>
                      Your business details and contact information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company_name" className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Company Name
                        </Label>
                        <Input
                          id="company_name"
                          placeholder="Your Company Ltd"
                          value={companySettings.name}
                          onChange={(e) => setCompanySettings({ ...companySettings, name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_email" className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Business Email
                        </Label>
                        <Input
                          id="company_email"
                          type="email"
                          placeholder="info@company.com"
                          value={companySettings.email}
                          onChange={(e) => setCompanySettings({ ...companySettings, email: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_phone" className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Number
                        </Label>
                        <Input
                          id="company_phone"
                          placeholder="+356 1234 5678"
                          value={companySettings.phone}
                          onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_vat_number">
                          VAT Number
                        </Label>
                        <Input
                          id="company_vat_number"
                          placeholder="MT12345678"
                          value={companySettings.taxId}
                          onChange={(e) => setCompanySettings({ ...companySettings, taxId: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="company_address" className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Business Address
                        </Label>
                        <Textarea
                          id="company_address"
                          placeholder="Street Address, City, Country"
                          rows={3}
                          value={companySettings.address}
                          onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_registration">
                          Registration Number
                        </Label>
                        <Input
                          id="company_registration"
                          placeholder="C12345"
                          value={companySettings.registrationNumber}
                          onChange={(e) => setCompanySettings({ ...companySettings, registrationNumber: e.target.value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Business Settings Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="h-5 w-5" />
                      Business Settings
                    </CardTitle>
                    <CardDescription>
                      Configure default settings for invoices and quotations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="currency_code">
                          Default Currency
                        </Label>
                        <Select
                          value={invoiceSettings.defaultCurrency}
                          onValueChange={(value) => setInvoiceSettings({ ...invoiceSettings, defaultCurrency: value })}
                        >
                          <SelectTrigger id="currency_code">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="default_payment_terms">
                          Default Payment Terms
                        </Label>
                        <Select
                          value={invoiceSettings.defaultPaymentTerms.toString()}
                          onValueChange={(value) => setInvoiceSettings({ ...invoiceSettings, defaultPaymentTerms: parseInt(value) })}
                        >
                          <SelectTrigger id="default_payment_terms">
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Due on receipt</SelectItem>
                            <SelectItem value="7">Net 7 days</SelectItem>
                            <SelectItem value="14">Net 14 days</SelectItem>
                            <SelectItem value="30">Net 30 days</SelectItem>
                            <SelectItem value="60">Net 60 days</SelectItem>
                            <SelectItem value="90">Net 90 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="invoice_prefix">
                          Invoice Prefix
                        </Label>
                        <Input
                          id="invoice_prefix"
                          placeholder="INV-"
                          value={invoiceSettings.prefix}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, prefix: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="quotation_prefix">
                          Quotation Prefix
                        </Label>
                        <Input
                          id="quotation_prefix"
                          placeholder="QUO-"
                          value={companySettings.name}
                          onChange={(e) => setCompanySettings({ ...companySettings, name: e.target.value })}
                        />
                      </div>
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
              </div>
            </TabsContent>

            {/* Banking Tab */}
            <TabsContent value="banking">
              <div className="space-y-6">
                {/* Primary Bank Account Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Primary Bank Account
                    </CardTitle>
                    <CardDescription>
                      Your bank account details that will appear on invoices
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bank_name">
                          Bank Name
                        </Label>
                        <Input
                          id="bank_name"
                          placeholder="e.g., Bank of Valletta"
                          value={bankingSettings.bankName}
                          onChange={(e) => setBankingSettings({ ...bankingSettings, bankName: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bank_account_name">
                          Account Holder Name
                        </Label>
                        <Input
                          id="bank_account_name"
                          placeholder="Your Company Ltd"
                          value={bankingSettings.accountName}
                          onChange={(e) => setBankingSettings({ ...bankingSettings, accountName: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bank_iban">
                          IBAN
                        </Label>
                        <Input
                          id="bank_iban"
                          placeholder="MT84MALT011000012345MTLCAST001S"
                          value={bankingSettings.iban}
                          onChange={(e) => setBankingSettings({ ...bankingSettings, iban: e.target.value })}
                          className={bankingSettings.iban && !validateIBAN(bankingSettings.iban) ? "border-destructive" : ""}
                        />
                        {bankingSettings.iban && !validateIBAN(bankingSettings.iban) && (
                          <p className="text-xs text-destructive">Invalid IBAN format</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bank_swift">
                          SWIFT/BIC Code
                        </Label>
                        <Input
                          id="bank_swift"
                          placeholder="VALLMTMT"
                          value={bankingSettings.swiftCode}
                          onChange={(e) => setBankingSettings({ ...bankingSettings, swiftCode: e.target.value })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Banking Preferences Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="h-5 w-5" />
                      Banking Preferences
                    </CardTitle>
                    <CardDescription>
                      Control how banking information appears on your invoices
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="include_banking">
                            Show bank details on invoices
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Display your bank account information on generated invoices
                          </p>
                        </div>
                        <Switch
                          id="include_banking"
                          checked={bankingPreferences.includeBankingOnInvoices}
                          onCheckedChange={(checked) => 
                            setBankingPreferences({ ...bankingPreferences, includeBankingOnInvoices: checked })
                          }
                        />
                      </div>

                      {bankingPreferences.includeBankingOnInvoices && (
                        <div className="space-y-2">
                          <Label htmlFor="banking_format">
                            Display Format
                          </Label>
                          <Select
                            value={bankingPreferences.bankingDisplayFormat}
                            onValueChange={(value) => 
                              setBankingPreferences({ ...bankingPreferences, bankingDisplayFormat: value })
                            }
                          >
                            <SelectTrigger id="banking_format">
                              <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">Full details (Bank, IBAN, SWIFT)</SelectItem>
                              <SelectItem value="iban">IBAN only</SelectItem>
                              <SelectItem value="custom">Custom (editable in template)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Choose how much banking information to display on invoices
                          </p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="flex justify-end">
                      <Button onClick={handleSaveBanking} disabled={isLoading}>
                        <Save className="mr-2 h-4 w-4" />
                        {isLoading ? "Saving..." : "Save Banking Details"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
