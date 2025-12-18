import { useState, useEffect, useCallback } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, CheckCircle2, AlertCircle, Upload, Image as ImageIcon, X } from "lucide-react";
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
  addressLine1: string;
  addressLine2: string;
  locality: string;
  postCode: string;
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
  latePaymentInterestRate: number;
  earlyPaymentDiscountRate: number;
  earlyPaymentDiscountDays: number;
  includePaymentInstructions: boolean;
  vatRateStandard: number;
  vatRateReduced: number;
  vatRateZero: number;
  invoiceLanguage: string;
  includeVatBreakdown: boolean;
  reverseChargeNote: string;
  defaultSupplyPlace: string;
  intrastatThreshold: number;
  distanceSellingThreshold: number;
  includeEoriNumber: boolean;
  euVatMossEligible: boolean;
}

interface BankingPreferences {
  includeBankingOnInvoices: boolean;
  bankingDisplayFormat: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  emailReminders: boolean;
  paymentNotifications: boolean;
  overdueAlerts: boolean;
  weeklyReports: boolean;
  customerCommunications: boolean;
  firstReminderDays: number;
  secondReminderDays: number;
  finalNoticeDays: number;
}

interface PreferenceSettings {
  theme: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  currencySymbolDisplay: string;
  currencyPosition: string;
  itemsPerPage: number;
  defaultView: string;
}

const Settings = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // State management for all settings categories
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    addressLine1: "",
    addressLine2: "",
    locality: "",
    postCode: "",
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
    prefix: "INV-",
    nextNumber: 1001,
    defaultCurrency: "EUR",
    defaultPaymentTerms: 30,
    defaultTaxRate: 18,
    footer: "",
    notes: "",
    latePaymentInterestRate: 8,
    earlyPaymentDiscountRate: 0,
    earlyPaymentDiscountDays: 0,
    includePaymentInstructions: true,
    vatRateStandard: 18,
    vatRateReduced: 5,
    vatRateZero: 0,
    invoiceLanguage: "en",
    includeVatBreakdown: true,
    reverseChargeNote: "Reverse charge applies - VAT to be accounted for by the recipient as per Article 196 of Council Directive 2006/112/EC",
    defaultSupplyPlace: "malta",
    intrastatThreshold: 50000,
    distanceSellingThreshold: 10000,
    includeEoriNumber: false,
    euVatMossEligible: false,
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    emailReminders: true,
    paymentNotifications: true,
    overdueAlerts: true,
    weeklyReports: false,
    customerCommunications: false,
    firstReminderDays: 7,
    secondReminderDays: 14,
    finalNoticeDays: 21,
  });

  const [preferenceSettings, setPreferenceSettings] = useState<PreferenceSettings>({
    theme: "system",
    language: "en",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    currencySymbolDisplay: "symbol",
    currencyPosition: "before",
    itemsPerPage: 25,
    defaultView: "table",
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;
      
      try {
        // Load company settings
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (companyData) {
          setCompanySettings({
            name: companyData.company_name || "",
            email: companyData.company_email || "",
            phone: companyData.company_phone || "",
            website: companyData.company_website || "",
            address: companyData.company_address || "",
            addressLine1: companyData.company_address_line1 || "",
            addressLine2: companyData.company_address_line2 || "",
            locality: companyData.company_locality || "",
            postCode: companyData.company_post_code || "",
            city: companyData.company_city || "",
            state: companyData.company_state || "",
            zipCode: companyData.company_zip_code || "",
            country: companyData.company_country || "",
            taxId: companyData.company_vat_number || "",
            registrationNumber: companyData.company_registration_number || "",
            logo: companyData.company_logo || "",
          });
        }

        // Load banking settings
        const { data: bankingData } = await supabase
          .from('banking_details')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (bankingData) {
          setBankingSettings({
            bankName: bankingData.bank_name || "",
            accountName: bankingData.bank_account_name || "",
            accountNumber: bankingData.bank_account_number || "",
            routingNumber: bankingData.bank_routing_number || "",
            swiftCode: bankingData.bank_swift_code || "",
            iban: bankingData.bank_iban || "",
            branch: bankingData.bank_branch || "",
          });
          setBankingPreferences({
            includeBankingOnInvoices: bankingData.include_on_invoices ?? true,
            bankingDisplayFormat: bankingData.display_format || "full",
          });
        }

        // Load invoice settings
        const { data: invoiceData } = await supabase
          .from('invoice_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (invoiceData) {
          setInvoiceSettings({
            prefix: invoiceData.numbering_prefix || "INV-",
            nextNumber: invoiceData.next_invoice_number || 1001,
            defaultCurrency: "EUR",
            defaultPaymentTerms: invoiceData.default_payment_days || 30,
            defaultTaxRate: invoiceData.vat_rate_standard || 18,
            footer: invoiceData.invoice_footer_text || "",
            notes: invoiceData.default_invoice_notes || "",
            latePaymentInterestRate: invoiceData.late_payment_interest_rate || 8,
            earlyPaymentDiscountRate: invoiceData.early_payment_discount_rate || 0,
            earlyPaymentDiscountDays: invoiceData.early_payment_discount_days || 0,
            includePaymentInstructions: invoiceData.include_payment_instructions ?? true,
            vatRateStandard: invoiceData.vat_rate_standard || 18,
            vatRateReduced: invoiceData.vat_rate_reduced || 5,
            vatRateZero: invoiceData.vat_rate_zero || 0,
            invoiceLanguage: invoiceData.invoice_language || "en",
            includeVatBreakdown: invoiceData.include_vat_breakdown ?? true,
            reverseChargeNote: invoiceData.reverse_charge_note || "",
            defaultSupplyPlace: invoiceData.default_supply_place || "malta",
            intrastatThreshold: invoiceData.intrastat_threshold || 50000,
            distanceSellingThreshold: invoiceData.distance_selling_threshold || 10000,
            includeEoriNumber: invoiceData.include_eori_number ?? false,
            euVatMossEligible: invoiceData.eu_vat_moss_eligible ?? false,
          });
        }

        // Load user preferences
        const { data: prefsData } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (prefsData) {
          setNotificationSettings({
            emailNotifications: prefsData.email_reminders ?? true,
            emailReminders: prefsData.email_reminders ?? true,
            paymentNotifications: prefsData.payment_notifications ?? true,
            overdueAlerts: prefsData.overdue_alerts ?? true,
            weeklyReports: prefsData.weekly_reports ?? false,
            customerCommunications: prefsData.customer_communications ?? false,
            firstReminderDays: prefsData.first_reminder_days || 7,
            secondReminderDays: prefsData.second_reminder_days || 14,
            finalNoticeDays: prefsData.final_notice_days || 21,
          });

          setPreferenceSettings({
            theme: prefsData.theme || "system",
            language: prefsData.language || "en",
            dateFormat: prefsData.date_format || "DD/MM/YYYY",
            timeFormat: prefsData.time_format || "24h",
            currencySymbolDisplay: prefsData.currency_symbol_display || "symbol",
            currencyPosition: prefsData.currency_position || "before",
            itemsPerPage: prefsData.items_per_page || 25,
            defaultView: prefsData.default_view || "table",
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadSettings();
  }, [user?.id]);

  // Validation helpers
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // Malta phone format: +356 followed by 8 digits
    const phoneRegex = /^\+356\s?\d{4}\s?\d{4}$/;
    return phoneRegex.test(phone);
  };

  const validateMaltaVAT = (vat: string): boolean => {
    // Malta VAT: MT followed by 8 digits
    const vatRegex = /^MT\d{8}$/;
    return vatRegex.test(vat.replace(/\s/g, ''));
  };

  // Handle logo upload
  const handleLogoUpload = async (file: File) => {
    if (!user?.id) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setValidationErrors(prev => ({
        ...prev,
        logo: 'Please upload a PNG or JPG file'
      }));
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setValidationErrors(prev => ({
        ...prev,
        logo: 'File size must be less than 5MB'
      }));
      return;
    }

    setIsLoading(true);
    setValidationErrors(prev => ({ ...prev, logo: '' }));

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // Update company settings with logo URL
      setCompanySettings(prev => ({
        ...prev,
        logo: data.publicUrl
      }));

      setHasUnsavedChanges(true);

      toast({
        title: "Logo uploaded",
        description: "Logo has been uploaded successfully. Click Save to persist.",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      setValidationErrors(prev => ({
        ...prev,
        logo: 'Failed to upload logo. Please try again.'
      }));
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logo removal
  const handleRemoveLogo = () => {
    setCompanySettings(prev => ({
      ...prev,
      logo: ''
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveCompany = async () => {
    // Validate fields
    const errors: Record<string, string> = {};
    
    if (companySettings.email && !validateEmail(companySettings.email)) {
      errors.company_email = "Please enter a valid email address";
    }
    
    if (companySettings.phone && !validatePhone(companySettings.phone)) {
      errors.company_phone = "Please use Malta format: +356 1234 5678";
    }
    
    if (companySettings.taxId && companySettings.taxId.startsWith('MT') && !validateMaltaVAT(companySettings.taxId)) {
      errors.company_vat = "Malta VAT format: MT followed by 8 digits";
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setValidationErrors({});
    setIsLoading(true);
    
    try {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('company_settings')
        .upsert({
          user_id: user.id,
          company_name: companySettings.name,
          company_email: companySettings.email,
          company_phone: companySettings.phone,
          company_website: companySettings.website,
          company_address: companySettings.address,
          company_address_line1: companySettings.addressLine1,
          company_address_line2: companySettings.addressLine2,
          company_locality: companySettings.locality,
          company_post_code: companySettings.postCode,
          company_city: companySettings.city,
          company_state: companySettings.state,
          company_zip_code: companySettings.zipCode,
          company_country: companySettings.country,
          company_vat_number: companySettings.taxId,
          company_registration_number: companySettings.registrationNumber,
          company_logo: companySettings.logo,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Company settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving company settings:', error);
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
      setValidationErrors({ banking_iban: "Please enter a valid IBAN format" });
      toast({
        title: "Validation Error",
        description: "Please enter a valid IBAN format",
        variant: "destructive",
      });
      return;
    }

    setValidationErrors({});
    setIsLoading(true);
    
    try {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('banking_details')
        .upsert({
          user_id: user.id,
          bank_name: bankingSettings.bankName,
          bank_account_name: bankingSettings.accountName,
          bank_account_number: bankingSettings.accountNumber,
          bank_routing_number: bankingSettings.routingNumber,
          bank_swift_code: bankingSettings.swiftCode,
          bank_iban: bankingSettings.iban,
          bank_branch: bankingSettings.branch,
          include_on_invoices: bankingPreferences.includeBankingOnInvoices,
          display_format: bankingPreferences.bankingDisplayFormat,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Banking settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving banking settings:', error);
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
    // Validate VAT rates
    if (invoiceSettings.vatRateStandard < 0 || invoiceSettings.vatRateStandard > 27) {
      toast({
        title: "Validation Error",
        description: "Standard VAT rate must be between 0% and 27% (EU maximum)",
        variant: "destructive",
      });
      return;
    }

    if (invoiceSettings.vatRateReduced < 0 || invoiceSettings.vatRateReduced > 27) {
      toast({
        title: "Validation Error",
        description: "Reduced VAT rate must be between 0% and 27%",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('invoice_settings')
        .upsert({
          user_id: user.id,
          numbering_prefix: invoiceSettings.prefix,
          next_invoice_number: invoiceSettings.nextNumber,
          default_payment_days: invoiceSettings.defaultPaymentTerms,
          late_payment_interest_rate: invoiceSettings.latePaymentInterestRate,
          vat_rate_standard: invoiceSettings.vatRateStandard,
          vat_rate_reduced: invoiceSettings.vatRateReduced,
          vat_rate_zero: invoiceSettings.vatRateZero,
          invoice_language: invoiceSettings.invoiceLanguage,
          include_vat_breakdown: invoiceSettings.includeVatBreakdown,
          invoice_footer_text: invoiceSettings.footer,
          default_invoice_notes: invoiceSettings.notes,
          include_payment_instructions: invoiceSettings.includePaymentInstructions,
          early_payment_discount_rate: invoiceSettings.earlyPaymentDiscountRate,
          early_payment_discount_days: invoiceSettings.earlyPaymentDiscountDays,
          reverse_charge_note: invoiceSettings.reverseChargeNote,
          default_supply_place: invoiceSettings.defaultSupplyPlace,
          intrastat_threshold: invoiceSettings.intrastatThreshold,
          distance_selling_threshold: invoiceSettings.distanceSellingThreshold,
          include_eori_number: invoiceSettings.includeEoriNumber,
          eu_vat_moss_eligible: invoiceSettings.euVatMossEligible,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Invoice settings saved successfully. All changes comply with EU VAT regulations.",
      });
    } catch (error) {
      console.error('Error saving invoice settings:', error);
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
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          email_reminders: notificationSettings.emailReminders,
          payment_notifications: notificationSettings.paymentNotifications,
          overdue_alerts: notificationSettings.overdueAlerts,
          weekly_reports: notificationSettings.weeklyReports,
          customer_communications: notificationSettings.customerCommunications,
          first_reminder_days: notificationSettings.firstReminderDays,
          second_reminder_days: notificationSettings.secondReminderDays,
          final_notice_days: notificationSettings.finalNoticeDays,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Notification settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
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
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          theme: preferenceSettings.theme,
          language: preferenceSettings.language,
          date_format: preferenceSettings.dateFormat,
          time_format: preferenceSettings.timeFormat,
          currency_symbol_display: preferenceSettings.currencySymbolDisplay,
          currency_position: preferenceSettings.currencyPosition,
          items_per_page: preferenceSettings.itemsPerPage,
          default_view: preferenceSettings.defaultView,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Preferences saved successfully",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SettingsIcon className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                  <p className="text-sm text-muted-foreground">
                    Manage your company information, banking, and application preferences
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Unsaved changes</span>
                  </div>
                )}
                {lastSaved && !hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">
                      Saved {lastSaved.toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {isInitialLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading settings...</p>
              </div>
            </div>
          ) : (
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
                    {/* Logo Upload Section */}
                    <div className="space-y-4 mb-6 p-4 border border-border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Company Logo
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <InfoIcon className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Upload your company logo to appear on invoices and documents. Supports PNG, JPG (max 5MB).</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      {companySettings.logo ? (
                        <div className="flex items-start gap-4">
                          <div className="relative">
                            <img 
                              src={companySettings.logo} 
                              alt="Company Logo" 
                              className="h-24 w-auto object-contain border border-border rounded"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/png,image/jpeg,image/jpg';
                                input.onchange = (e: any) => {
                                  const file = e.target?.files?.[0];
                                  if (file) handleLogoUpload(file);
                                };
                                input.click();
                              }}
                              disabled={isLoading}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Change Logo
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRemoveLogo}
                              disabled={isLoading}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remove Logo
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/png,image/jpeg,image/jpg';
                            input.onchange = (e: any) => {
                              const file = e.target?.files?.[0];
                              if (file) handleLogoUpload(file);
                            };
                            input.click();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files[0];
                            if (file) handleLogoUpload(file);
                          }}
                          onDragOver={(e) => e.preventDefault()}
                        >
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-1">
                            {isLoading ? 'Uploading...' : 'Click to upload or drag and drop'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG up to 5MB
                          </p>
                        </div>
                      )}

                      {validationErrors.logo && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {validationErrors.logo}
                        </p>
                      )}
                    </div>

                    <Separator className="my-6" />

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
                          className={validationErrors.company_email ? "border-destructive" : ""}
                        />
                        {validationErrors.company_email && (
                          <p className="text-xs text-destructive">{validationErrors.company_email}</p>
                        )}
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
                          className={validationErrors.company_phone ? "border-destructive" : ""}
                        />
                        {validationErrors.company_phone ? (
                          <p className="text-xs text-destructive">{validationErrors.company_phone}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Format: +356 1234 5678</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_vat_number" className="flex items-center gap-2">
                          VAT Number
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <InfoIcon className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Malta VAT format: MT12345678 (MT followed by 8 digits)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <Input
                          id="company_vat_number"
                          placeholder="MT12345678"
                          value={companySettings.taxId}
                          onChange={(e) => setCompanySettings({ ...companySettings, taxId: e.target.value })}
                          className={validationErrors.company_vat ? "border-destructive" : ""}
                        />
                        {validationErrors.company_vat ? (
                          <p className="text-xs text-destructive">{validationErrors.company_vat}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Optional - Leave blank if exempt</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_address_line1" className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          House Name / Number
                        </Label>
                        <Input
                          id="company_address_line1"
                          placeholder="e.g. 123 or Villa Rosa"
                          value={companySettings.addressLine1 || ""}
                          onChange={(e) => setCompanySettings({ ...companySettings, addressLine1: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_address_line2">
                          Street Name
                        </Label>
                        <Input
                          id="company_address_line2"
                          placeholder="e.g. Republic Street"
                          value={companySettings.addressLine2 || ""}
                          onChange={(e) => setCompanySettings({ ...companySettings, addressLine2: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_locality">
                          Locality
                        </Label>
                        <Input
                          id="company_locality"
                          placeholder="e.g. Valletta"
                          value={companySettings.locality || ""}
                          onChange={(e) => setCompanySettings({ ...companySettings, locality: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_post_code">
                          Post Code
                        </Label>
                        <Input
                          id="company_post_code"
                          placeholder="e.g. VLT 1234"
                          value={companySettings.postCode || ""}
                          onChange={(e) => setCompanySettings({ ...companySettings, postCode: e.target.value })}
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
                        <Label htmlFor="bank_iban" className="flex items-center gap-2">
                          IBAN
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <InfoIcon className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">International Bank Account Number for receiving payments</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <Input
                          id="bank_iban"
                          placeholder="MT84MALT011000012345MTLCAST001S"
                          value={bankingSettings.iban}
                          onChange={(e) => setBankingSettings({ ...bankingSettings, iban: e.target.value })}
                          className={validationErrors.bank_iban ? "border-destructive" : ""}
                        />
                        {validationErrors.bank_iban ? (
                          <p className="text-xs text-destructive">{validationErrors.bank_iban}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Format: 2 letters, 2 digits, up to 30 alphanumeric</p>
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
              <div className="space-y-6">
                {/* Invoice Numbering (EU Compliance) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Invoice Numbering (EU Compliance)
                    </CardTitle>
                    <CardDescription>
                      Sequential invoice numbering as required by EU VAT regulations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg bg-muted p-4 border border-border">
                      <p className="text-sm text-muted-foreground">
                        ⚠️ <strong>EU VAT regulations require sequential, unbroken invoice numbering.</strong> Numbers cannot be reused or reset. This is mandatory under Article 226 of EU VAT Directive 2006/112/EC.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="numbering_system">
                          Numbering System
                        </Label>
                        <Select value="sequential" disabled>
                          <SelectTrigger id="numbering_system">
                            <SelectValue placeholder="Sequential (Required)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sequential">Sequential (EU Required)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Sequential numbering is mandatory for EU VAT compliance
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="next_invoice_number">
                          Next Invoice Number
                        </Label>
                        <Input
                          id="next_invoice_number"
                          value={invoiceSettings.nextNumber}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                          Read-only: Automatically increments with each invoice
                        </p>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="numbering_prefix">
                          Invoice Prefix (Optional)
                        </Label>
                        <Input
                          id="numbering_prefix"
                          placeholder="INV-"
                          value={invoiceSettings.prefix}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, prefix: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Optional prefix for invoice numbers (e.g., INV-2025-001)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Terms */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Terms
                    </CardTitle>
                    <CardDescription>
                      Configure default payment terms and late payment interest
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="default_payment_days">
                          Default Payment Terms
                        </Label>
                        <Select
                          value={invoiceSettings.defaultPaymentTerms.toString()}
                          onValueChange={(value) => setInvoiceSettings({ ...invoiceSettings, defaultPaymentTerms: parseInt(value) })}
                        >
                          <SelectTrigger id="default_payment_days">
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 days (Due on receipt)</SelectItem>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="14">14 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="60">60 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="late_payment_interest">
                          Late Payment Interest Rate (%)
                        </Label>
                        <Input
                          id="late_payment_interest"
                          type="number"
                          min="0"
                          max="20"
                          step="0.1"
                          value={invoiceSettings.latePaymentInterestRate}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, latePaymentInterestRate: parseFloat(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">
                          EU Late Payment Directive default: 8%
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="early_payment_discount">
                          Early Payment Discount Rate (%)
                        </Label>
                        <Input
                          id="early_payment_discount"
                          type="number"
                          min="0"
                          max="20"
                          step="0.1"
                          value={invoiceSettings.earlyPaymentDiscountRate}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, earlyPaymentDiscountRate: parseFloat(e.target.value) })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="early_payment_days">
                          Early Payment Period (Days)
                        </Label>
                        <Input
                          id="early_payment_days"
                          type="number"
                          min="0"
                          max="30"
                          value={invoiceSettings.earlyPaymentDiscountDays}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, earlyPaymentDiscountDays: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Document Content */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="h-5 w-5" />
                      Document Content
                    </CardTitle>
                    <CardDescription>
                      Default text and notes for invoices
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="invoice_footer">
                          Default Footer Text
                        </Label>
                        <Textarea
                          id="invoice_footer"
                          rows={3}
                          placeholder="Thank you for your business"
                          value={invoiceSettings.footer}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footer: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="invoice_notes">
                          Default Invoice Notes
                        </Label>
                        <Textarea
                          id="invoice_notes"
                          rows={3}
                          placeholder="Payment terms and conditions"
                          value={invoiceSettings.notes}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, notes: e.target.value })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="payment_instructions">
                            Include Payment Instructions
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Show bank details and payment methods on invoices
                          </p>
                        </div>
                        <Switch
                          id="payment_instructions"
                          checked={invoiceSettings.includePaymentInstructions}
                          onCheckedChange={(checked) => 
                            setInvoiceSettings({ ...invoiceSettings, includePaymentInstructions: checked })
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Malta VAT Compliance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Malta VAT Compliance
                    </CardTitle>
                    <CardDescription>
                      VAT rates and compliance settings for Malta
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        ℹ️ <strong>Malta VAT Requirements:</strong> Malta requires 6-year retention of VAT records. Invoices must contain all mandatory VAT elements per EU Directive 2006/112/EC. Malta businesses must issue invoices within 15 days of supply.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vat_standard">
                          Standard VAT Rate (%)
                        </Label>
                        <Input
                          id="vat_standard"
                          type="number"
                          min="0"
                          max="27"
                          step="0.1"
                          value={invoiceSettings.vatRateStandard}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, vatRateStandard: parseFloat(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Malta standard rate: 18%
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vat_reduced">
                          Reduced VAT Rate (%)
                        </Label>
                        <Input
                          id="vat_reduced"
                          type="number"
                          min="0"
                          max="27"
                          step="0.1"
                          value={invoiceSettings.vatRateReduced}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, vatRateReduced: parseFloat(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Malta reduced rate: 5% (specific goods/services)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vat_zero">
                          Zero VAT Rate (%)
                        </Label>
                        <Input
                          id="vat_zero"
                          type="number"
                          value={invoiceSettings.vatRateZero}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                          For exempt supplies and exports: 0%
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="invoice_language">
                          Invoice Language
                        </Label>
                        <Select
                          value={invoiceSettings.invoiceLanguage}
                          onValueChange={(value) => setInvoiceSettings({ ...invoiceSettings, invoiceLanguage: value })}
                        >
                          <SelectTrigger id="invoice_language">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="mt">Maltese</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Both are official EU languages in Malta
                        </p>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="vat_breakdown">
                              Show VAT Breakdown
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Display detailed VAT breakdown on invoices (recommended for B2B)
                            </p>
                          </div>
                          <Switch
                            id="vat_breakdown"
                            checked={invoiceSettings.includeVatBreakdown}
                            onCheckedChange={(checked) => 
                              setInvoiceSettings({ ...invoiceSettings, includeVatBreakdown: checked })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="reverse_charge">
                          Reverse Charge Text (B2B EU Transactions)
                        </Label>
                        <Textarea
                          id="reverse_charge"
                          rows={2}
                          value={invoiceSettings.reverseChargeNote}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, reverseChargeNote: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          B2B invoices to EU customers require customer VAT number for zero-rating
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* EU Cross-Border */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      EU Cross-Border Settings
                    </CardTitle>
                    <CardDescription>
                      Configure settings for EU and international trade
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="supply_place">
                          Default Place of Supply
                        </Label>
                        <Select
                          value={invoiceSettings.defaultSupplyPlace}
                          onValueChange={(value) => setInvoiceSettings({ ...invoiceSettings, defaultSupplyPlace: value })}
                        >
                          <SelectTrigger id="supply_place">
                            <SelectValue placeholder="Select place" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="malta">Malta</SelectItem>
                            <SelectItem value="customer">Customer Location</SelectItem>
                            <SelectItem value="performance">Performance Location</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="intrastat_threshold">
                          Intrastat Reporting Threshold (€)
                        </Label>
                        <Input
                          id="intrastat_threshold"
                          type="number"
                          min="0"
                          value={invoiceSettings.intrastatThreshold}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, intrastatThreshold: parseFloat(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Malta threshold: €50,000 for intra-EU trade
                        </p>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="distance_selling">
                          Distance Selling Threshold (€)
                        </Label>
                        <Input
                          id="distance_selling"
                          type="number"
                          min="0"
                          value={invoiceSettings.distanceSellingThreshold}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, distanceSellingThreshold: parseFloat(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Malta distance selling threshold: €10,000 (harmonized EU threshold from July 2021)
                        </p>
                      </div>

                      <div className="flex items-center justify-between md:col-span-2">
                        <div className="space-y-0.5">
                          <Label htmlFor="eori_number">
                            Include EORI Number
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Economic Operators Registration and Identification for customs
                          </p>
                        </div>
                        <Switch
                          id="eori_number"
                          checked={invoiceSettings.includeEoriNumber}
                          onCheckedChange={(checked) => 
                            setInvoiceSettings({ ...invoiceSettings, includeEoriNumber: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between md:col-span-2">
                        <div className="space-y-0.5">
                          <Label htmlFor="moss_eligible">
                            MOSS/OSS Eligible
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Mini One Stop Shop / One Stop Shop for digital services
                          </p>
                        </div>
                        <Switch
                          id="moss_eligible"
                          checked={invoiceSettings.euVatMossEligible}
                          onCheckedChange={(checked) => 
                            setInvoiceSettings({ ...invoiceSettings, euVatMossEligible: checked })
                          }
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-end">
                      <Button onClick={handleSaveInvoice} disabled={isLoading}>
                        <Save className="mr-2 h-4 w-4" />
                        {isLoading ? "Saving..." : "Save Invoice Settings"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <div className="space-y-6">
                {/* Email Notifications Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Email Notifications
                    </CardTitle>
                    <CardDescription>
                      Choose which email notifications you want to receive
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="email_reminders">
                            Payment Reminders
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Send email reminders for overdue invoices
                          </p>
                        </div>
                        <Switch
                          id="email_reminders"
                          checked={notificationSettings.emailReminders}
                          onCheckedChange={(checked) => 
                            setNotificationSettings({ ...notificationSettings, emailReminders: checked })
                          }
                        />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="payment_notifications">
                            Payment Received
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Get notified when payments are received
                          </p>
                        </div>
                        <Switch
                          id="payment_notifications"
                          checked={notificationSettings.paymentNotifications}
                          onCheckedChange={(checked) => 
                            setNotificationSettings({ ...notificationSettings, paymentNotifications: checked })
                          }
                        />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="overdue_alerts">
                            Overdue Alerts
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Daily alerts for overdue invoices
                          </p>
                        </div>
                        <Switch
                          id="overdue_alerts"
                          checked={notificationSettings.overdueAlerts}
                          onCheckedChange={(checked) => 
                            setNotificationSettings({ ...notificationSettings, overdueAlerts: checked })
                          }
                        />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="weekly_reports">
                            Weekly Reports
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Weekly summary of invoices and payments
                          </p>
                        </div>
                        <Switch
                          id="weekly_reports"
                          checked={notificationSettings.weeklyReports}
                          onCheckedChange={(checked) => 
                            setNotificationSettings({ ...notificationSettings, weeklyReports: checked })
                          }
                        />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="customer_communications">
                            Customer Updates
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Notifications when customers view/download invoices
                          </p>
                        </div>
                        <Switch
                          id="customer_communications"
                          checked={notificationSettings.customerCommunications}
                          onCheckedChange={(checked) => 
                            setNotificationSettings({ ...notificationSettings, customerCommunications: checked })
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Reminder Schedule Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Reminder Schedule
                    </CardTitle>
                    <CardDescription>
                      Configure when payment reminders are sent for overdue invoices
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_reminder">
                          First Reminder
                        </Label>
                        <Select
                          value={notificationSettings.firstReminderDays.toString()}
                          onValueChange={(value) => 
                            setNotificationSettings({ ...notificationSettings, firstReminderDays: parseInt(value) })
                          }
                        >
                          <SelectTrigger id="first_reminder">
                            <SelectValue placeholder="Select days" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 days after due date</SelectItem>
                            <SelectItem value="7">7 days after due date</SelectItem>
                            <SelectItem value="14">14 days after due date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="second_reminder">
                          Second Reminder
                        </Label>
                        <Select
                          value={notificationSettings.secondReminderDays.toString()}
                          onValueChange={(value) => 
                            setNotificationSettings({ ...notificationSettings, secondReminderDays: parseInt(value) })
                          }
                        >
                          <SelectTrigger id="second_reminder">
                            <SelectValue placeholder="Select days" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 days after 1st reminder</SelectItem>
                            <SelectItem value="14">14 days after 1st reminder</SelectItem>
                            <SelectItem value="21">21 days after 1st reminder</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="final_notice">
                          Final Notice
                        </Label>
                        <Select
                          value={notificationSettings.finalNoticeDays.toString()}
                          onValueChange={(value) => 
                            setNotificationSettings({ ...notificationSettings, finalNoticeDays: parseInt(value) })
                          }
                        >
                          <SelectTrigger id="final_notice">
                            <SelectValue placeholder="Select days" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="14">14 days after 2nd reminder</SelectItem>
                            <SelectItem value="21">21 days after 2nd reminder</SelectItem>
                            <SelectItem value="30">30 days after 2nd reminder</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted p-4 border border-border">
                      <p className="text-sm text-muted-foreground">
                        💡 <strong>Tip:</strong> Automated reminders help maintain healthy cash flow. Customers will receive polite reminders at the intervals you specify above.
                      </p>
                    </div>

                    <Separator />

                    <div className="flex justify-end">
                      <Button onClick={handleSaveNotifications} disabled={isLoading}>
                        <Save className="mr-2 h-4 w-4" />
                        {isLoading ? "Saving..." : "Save Notification Settings"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences">
              <div className="space-y-6">
                {/* Display Settings Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Display Settings
                    </CardTitle>
                    <CardDescription>
                      Customize the appearance and language of the application
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="theme">
                          Theme
                        </Label>
                        <Select
                          value={preferenceSettings.theme}
                          onValueChange={(value) => setPreferenceSettings({ ...preferenceSettings, theme: value })}
                        >
                          <SelectTrigger id="theme">
                            <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Choose your preferred color scheme
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="language">
                          Language
                        </Label>
                        <Select
                          value={preferenceSettings.language}
                          onValueChange={(value) => setPreferenceSettings({ ...preferenceSettings, language: value })}
                        >
                          <SelectTrigger id="language">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="mt">Maltese (Coming Soon)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Select your preferred language
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="date_format">
                          Date Format
                        </Label>
                        <Select
                          value={preferenceSettings.dateFormat}
                          onValueChange={(value) => setPreferenceSettings({ ...preferenceSettings, dateFormat: value })}
                        >
                          <SelectTrigger id="date_format">
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</SelectItem>
                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</SelectItem>
                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          How dates should be displayed
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="time_format">
                          Time Format
                        </Label>
                        <Select
                          value={preferenceSettings.timeFormat}
                          onValueChange={(value) => setPreferenceSettings({ ...preferenceSettings, timeFormat: value })}
                        >
                          <SelectTrigger id="time_format">
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24h">24-hour (14:30)</SelectItem>
                            <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          How times should be displayed
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Currency Display Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Currency Display
                    </CardTitle>
                    <CardDescription>
                      Customize how currency values are formatted and displayed
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="currency_symbol">
                          Currency Display
                        </Label>
                        <Select
                          value={preferenceSettings.currencySymbolDisplay}
                          onValueChange={(value) => setPreferenceSettings({ ...preferenceSettings, currencySymbolDisplay: value })}
                        >
                          <SelectTrigger id="currency_symbol">
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="symbol">Symbol (€)</SelectItem>
                            <SelectItem value="code">Code (EUR)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Show currency as symbol or code
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="currency_position">
                          Currency Position
                        </Label>
                        <Select
                          value={preferenceSettings.currencyPosition}
                          onValueChange={(value) => setPreferenceSettings({ ...preferenceSettings, currencyPosition: value })}
                        >
                          <SelectTrigger id="currency_position">
                            <SelectValue placeholder="Select position" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="before">Before amount (€100.00)</SelectItem>
                            <SelectItem value="after">After amount (100.00€)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Where to place the currency symbol
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted p-4 border border-border">
                      <p className="text-sm text-muted-foreground">
                        <strong>Preview:</strong>{" "}
                        {preferenceSettings.currencyPosition === "before" 
                          ? `${preferenceSettings.currencySymbolDisplay === "symbol" ? "€" : "EUR"} 1,234.56`
                          : `1,234.56 ${preferenceSettings.currencySymbolDisplay === "symbol" ? "€" : "EUR"}`
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Data Display Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="h-5 w-5" />
                      Data Display
                    </CardTitle>
                    <CardDescription>
                      Control how data is displayed in lists and tables
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="items_per_page">
                          Items per Page
                        </Label>
                        <Select
                          value={preferenceSettings.itemsPerPage.toString()}
                          onValueChange={(value) => setPreferenceSettings({ ...preferenceSettings, itemsPerPage: parseInt(value) })}
                        >
                          <SelectTrigger id="items_per_page">
                            <SelectValue placeholder="Select number" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 items</SelectItem>
                            <SelectItem value="25">25 items</SelectItem>
                            <SelectItem value="50">50 items</SelectItem>
                            <SelectItem value="100">100 items</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Number of items to show per page in lists
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="default_view">
                          Default List View
                        </Label>
                        <Select
                          value={preferenceSettings.defaultView}
                          onValueChange={(value) => setPreferenceSettings({ ...preferenceSettings, defaultView: value })}
                        >
                          <SelectTrigger id="default_view">
                            <SelectValue placeholder="Select view" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="table">Table View</SelectItem>
                            <SelectItem value="cards">Cards View</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Preferred layout for viewing lists
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-end">
                      <Button onClick={handleSavePreferences} disabled={isLoading}>
                        <Save className="mr-2 h-4 w-4" />
                        {isLoading ? "Saving..." : "Save Preferences"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          )}
        </main>
      </div>
    </div>
  );
};

export default Settings;
