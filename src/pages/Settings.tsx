import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
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
import { InfoIcon, CheckCircle2, AlertCircle, Upload, Image as ImageIcon, X, ChevronDown, Globe } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  MapPin,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  defaultCurrency: string;
  defaultPaymentTerms: number;
  // FIX: invoicePrefix / quotationPrefix removed — they duplicated Invoice tab fields
  // and company_settings.invoice_prefix is never read by the numbering RPC.
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

interface BankingPreferences {
  includeBankingOnInvoices: boolean;
  bankingDisplayFormat: string;
}

interface InvoiceSettings {
  prefix: string;
  nextNumber: number;
  isFirstInvoice: boolean; // FIX: tracks whether counter is still at default so we allow editing
  defaultCurrency: string;
  defaultPaymentTerms: number;
  defaultTaxRate: number;
  footer: string;
  notes: string;
  quotationTerms: string;
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

// ── Default states ─────────────────────────────────────────────────────────────

const DEFAULT_COMPANY: CompanySettings = {
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
  defaultCurrency: "EUR",
  defaultPaymentTerms: 30,
};

const DEFAULT_BANKING: BankingSettings = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  routingNumber: "",
  swiftCode: "",
  iban: "",
  branch: "",
};

const DEFAULT_BANKING_PREFS: BankingPreferences = {
  includeBankingOnInvoices: true,
  bankingDisplayFormat: "full",
};

const DEFAULT_INVOICE: InvoiceSettings = {
  prefix: "INV-",
  nextNumber: 1001,
  isFirstInvoice: true,
  defaultCurrency: "EUR",
  defaultPaymentTerms: 30,
  defaultTaxRate: 18,
  footer: "",
  notes: "",
  quotationTerms: "",
  latePaymentInterestRate: 8,
  earlyPaymentDiscountRate: 0,
  earlyPaymentDiscountDays: 0,
  includePaymentInstructions: true,
  vatRateStandard: 18,
  vatRateReduced: 5,
  vatRateZero: 0,
  invoiceLanguage: "en",
  includeVatBreakdown: true,
  reverseChargeNote:
    "Reverse charge applies - VAT to be accounted for by the recipient as per Article 196 of Council Directive 2006/112/EC",
  defaultSupplyPlace: "malta",
  intrastatThreshold: 50000,
  distanceSellingThreshold: 10000,
  includeEoriNumber: false,
  euVatMossEligible: false,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailNotifications: true,
  emailReminders: true,
  paymentNotifications: true,
  overdueAlerts: true,
  weeklyReports: false,
  customerCommunications: false,
  firstReminderDays: 7,
  secondReminderDays: 14,
  finalNoticeDays: 21,
};

const DEFAULT_PREFERENCES: PreferenceSettings = {
  theme: "light",
  language: "en",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
  currencySymbolDisplay: "symbol",
  currencyPosition: "before",
  itemsPerPage: 25,
  defaultView: "table",
};

// ── Component ──────────────────────────────────────────────────────────────────

const Settings = () => {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // FIX: per-tab unsaved change tracking instead of one shared flag
  const [unsaved, setUnsaved] = useState({
    company: false,
    banking: false,
    invoice: false,
    notifications: false,
    preferences: false,
  });
  const [lastSaved, setLastSaved] = useState<{ tab: string; time: Date } | null>(null);

  const markUnsaved = (tab: keyof typeof unsaved) => setUnsaved((prev) => ({ ...prev, [tab]: true }));
  const markSaved = (tab: keyof typeof unsaved) => {
    setUnsaved((prev) => ({ ...prev, [tab]: false }));
    setLastSaved({ tab, time: new Date() });
  };

  const [companySettings, setCompanySettings] = useState<CompanySettings>(DEFAULT_COMPANY);
  const [bankingSettings, setBankingSettings] = useState<BankingSettings>(DEFAULT_BANKING);
  const [bankingPreferences, setBankingPreferences] = useState<BankingPreferences>(DEFAULT_BANKING_PREFS);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(DEFAULT_INVOICE);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [preferenceSettings, setPreferenceSettings] = useState<PreferenceSettings>(DEFAULT_PREFERENCES);

  // ── Load settings ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const [{ data: companyData }, { data: bankingData }, { data: invoiceData }, { data: prefsData }] =
          await Promise.all([
            supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("banking_details").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("invoice_settings").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
          ]);

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
            defaultCurrency: companyData.currency_code || "EUR",
            defaultPaymentTerms: companyData.default_payment_terms || 30,
          });
        }

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

        if (invoiceData) {
          const nextNum = invoiceData.next_invoice_number || 1001;
          setInvoiceSettings({
            prefix: invoiceData.numbering_prefix || "INV-",
            nextNumber: nextNum,
            // FIX: allow editing next number only if still at default (no invoices created yet)
            isFirstInvoice: nextNum === 1001,
            defaultCurrency: "EUR",
            defaultPaymentTerms: invoiceData.default_payment_days || 30,
            defaultTaxRate: invoiceData.vat_rate_standard || 18,
            footer: invoiceData.invoice_footer_text || "",
            notes: invoiceData.default_invoice_notes || "",
            quotationTerms: (invoiceData as any).quotation_terms_text || "",
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
            theme: prefsData.theme === "system" ? "light" : prefsData.theme || "light",
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
        console.error("Error loading settings:", error);
        toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
      } finally {
        setIsInitialLoading(false);
      }
    };
    load();
  }, [user?.id]);

  // ── Validation helpers ───────────────────────────────────────────────────────

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // FIX: accepts any international phone number — digits, spaces, +, -, (, ), min 6 chars
  const validatePhone = (phone: string) => /^[+\d][\d\s\-().]{5,24}$/.test(phone.trim());

  const validateMaltaVAT = (vat: string) => /^MT\d{8}$/.test(vat.replace(/\s/g, ""));

  const validateIBAN = (iban: string) => /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(iban.replace(/\s/g, "").toUpperCase());

  // ── Logo upload ──────────────────────────────────────────────────────────────

  const handleLogoUpload = async (file: File) => {
    if (!user?.id) return;
    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      setValidationErrors((p) => ({ ...p, logo: "Please upload a PNG or JPG file" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setValidationErrors((p) => ({ ...p, logo: "File size must be less than 5MB" }));
      return;
    }
    setIsLoading(true);
    setValidationErrors((p) => ({ ...p, logo: "" }));
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("logos").getPublicUrl(fileName);
      setCompanySettings((p) => ({ ...p, logo: data.publicUrl }));
      markUnsaved("company");
      toast({ title: "Logo uploaded", description: "Click Save to persist." });
    } catch (error) {
      setValidationErrors((p) => ({ ...p, logo: "Failed to upload logo. Please try again." }));
      toast({ title: "Upload failed", description: "Failed to upload logo.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLogo = () => {
    setCompanySettings((p) => ({ ...p, logo: "" }));
    markUnsaved("company");
  };

  const triggerFileInput = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/jpg";
    input.onchange = (e: any) => {
      const f = e.target?.files?.[0];
      if (f) handleLogoUpload(f);
    };
    input.click();
  };

  // ── Save handlers ────────────────────────────────────────────────────────────

  const handleSaveCompany = async () => {
    const errors: Record<string, string> = {};
    if (companySettings.email && !validateEmail(companySettings.email))
      errors.company_email = "Please enter a valid email address";
    // FIX: relaxed phone validation — any international format accepted
    if (companySettings.phone && !validatePhone(companySettings.phone))
      errors.company_phone = "Please enter a valid phone number (include country code, e.g. +356 99123456)";
    if (companySettings.taxId && companySettings.taxId.startsWith("MT") && !validateMaltaVAT(companySettings.taxId))
      errors.company_vat = "Malta VAT format: MT followed by 8 digits (e.g. MT12345678)";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setIsLoading(true);
    try {
      if (!user?.id) throw new Error("User not authenticated");
      const { error } = await supabase.from("company_settings").upsert(
        {
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
          currency_code: companySettings.defaultCurrency,
          default_payment_terms: companySettings.defaultPaymentTerms,
          // FIX: not saving invoice_prefix here — only invoice_settings.numbering_prefix is used
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      markSaved("company");
      toast({ title: "Saved", description: "Company settings saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save company settings", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBanking = async () => {
    if (bankingSettings.iban && !validateIBAN(bankingSettings.iban)) {
      setValidationErrors({ banking_iban: "Please enter a valid IBAN format" });
      toast({ title: "Validation Error", description: "Please enter a valid IBAN format", variant: "destructive" });
      return;
    }
    setValidationErrors({});
    setIsLoading(true);
    try {
      if (!user?.id) throw new Error("User not authenticated");
      const { error } = await supabase.from("banking_details").upsert(
        {
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
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      markSaved("banking");
      toast({ title: "Saved", description: "Banking details saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save banking settings", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveInvoice = async () => {
    if (invoiceSettings.vatRateStandard < 0 || invoiceSettings.vatRateStandard > 27) {
      toast({
        title: "Validation Error",
        description: "Standard VAT rate must be between 0% and 27%",
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
      if (!user?.id) throw new Error("User not authenticated");
      const { error } = await supabase.from("invoice_settings").upsert(
        {
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
          quotation_terms_text: invoiceSettings.quotationTerms,
          include_payment_instructions: invoiceSettings.includePaymentInstructions,
          early_payment_discount_rate: invoiceSettings.earlyPaymentDiscountRate,
          early_payment_discount_days: invoiceSettings.earlyPaymentDiscountDays,
          reverse_charge_note: invoiceSettings.reverseChargeNote,
          default_supply_place: invoiceSettings.defaultSupplyPlace,
          intrastat_threshold: invoiceSettings.intrastatThreshold,
          distance_selling_threshold: invoiceSettings.distanceSellingThreshold,
          include_eori_number: invoiceSettings.includeEoriNumber,
          eu_vat_moss_eligible: invoiceSettings.euVatMossEligible,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      // Once saved, lock the next number field (it is now authoritative)
      setInvoiceSettings((p) => ({ ...p, isFirstInvoice: false }));
      markSaved("invoice");
      toast({ title: "Saved", description: "Invoice settings saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save invoice settings", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsLoading(true);
    try {
      if (!user?.id) throw new Error("User not authenticated");
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          email_reminders: notificationSettings.emailReminders,
          payment_notifications: notificationSettings.paymentNotifications,
          overdue_alerts: notificationSettings.overdueAlerts,
          weekly_reports: notificationSettings.weeklyReports,
          customer_communications: notificationSettings.customerCommunications,
          first_reminder_days: notificationSettings.firstReminderDays,
          second_reminder_days: notificationSettings.secondReminderDays,
          final_notice_days: notificationSettings.finalNoticeDays,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      markSaved("notifications");
      toast({ title: "Saved", description: "Notification settings saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save notification settings", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      if (!user?.id) throw new Error("User not authenticated");
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          theme: preferenceSettings.theme,
          language: preferenceSettings.language,
          date_format: preferenceSettings.dateFormat,
          time_format: preferenceSettings.timeFormat,
          currency_symbol_display: preferenceSettings.currencySymbolDisplay,
          currency_position: preferenceSettings.currencyPosition,
          items_per_page: preferenceSettings.itemsPerPage,
          default_view: preferenceSettings.defaultView,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      setTheme(preferenceSettings.theme);
      markSaved("preferences");
      toast({ title: "Saved", description: "Preferences saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save preferences", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Helpers for tab header indicator ────────────────────────────────────────

  const TabUnsavedDot = ({ tab }: { tab: keyof typeof unsaved }) =>
    unsaved[tab] ? (
      <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
    ) : null;

  // ── Render ───────────────────────────────────────────────────────────────────

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
                    Manage your company information, banking, and preferences
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {Object.values(unsaved).some(Boolean) && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Unsaved changes on this tab</span>
                  </div>
                )}
                {lastSaved && !Object.values(unsaved).some(Boolean) && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Saved {lastSaved.time.toLocaleTimeString()}</span>
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading settings...</p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="company" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="company" className="gap-1">
                  <Building className="h-4 w-4" />
                  <span className="hidden sm:inline">Company</span>
                  <TabUnsavedDot tab="company" />
                </TabsTrigger>
                <TabsTrigger value="banking" className="gap-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Banking</span>
                  <TabUnsavedDot tab="banking" />
                </TabsTrigger>
                <TabsTrigger value="invoice" className="gap-1">
                  <Palette className="h-4 w-4" />
                  <span className="hidden sm:inline">Invoice</span>
                  <TabUnsavedDot tab="invoice" />
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-1">
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Notifications</span>
                  <TabUnsavedDot tab="notifications" />
                </TabsTrigger>
                <TabsTrigger value="preferences" className="gap-1">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Preferences</span>
                  <TabUnsavedDot tab="preferences" />
                </TabsTrigger>
              </TabsList>

              {/* ── Company Tab ── */}
              <TabsContent value="company">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Company Information
                      </CardTitle>
                      <CardDescription>Your business details and contact information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Logo */}
                      <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
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
                                <p className="max-w-xs">Appears on invoices and documents. PNG or JPG, max 5MB.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>

                        {companySettings.logo ? (
                          <div className="flex items-start gap-4">
                            <img
                              src={companySettings.logo}
                              alt="Company Logo"
                              className="h-24 w-auto object-contain border border-border rounded"
                            />
                            <div className="flex flex-col gap-2">
                              <Button variant="outline" size="sm" onClick={triggerFileInput} disabled={isLoading}>
                                <Upload className="h-4 w-4 mr-2" />
                                Change Logo
                              </Button>
                              <Button variant="outline" size="sm" onClick={handleRemoveLogo} disabled={isLoading}>
                                <X className="h-4 w-4 mr-2" />
                                Remove Logo
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={triggerFileInput}
                            onDrop={(e) => {
                              e.preventDefault();
                              const f = e.dataTransfer.files[0];
                              if (f) handleLogoUpload(f);
                            }}
                            onDragOver={(e) => e.preventDefault()}
                          >
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mb-1">
                              {isLoading ? "Uploading..." : "Click to upload or drag and drop"}
                            </p>
                            <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                          </div>
                        )}
                        {validationErrors.logo && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {validationErrors.logo}
                          </p>
                        )}
                      </div>

                      <Separator />

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
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, name: e.target.value });
                              markUnsaved("company");
                            }}
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
                            className={validationErrors.company_email ? "border-destructive" : ""}
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, email: e.target.value });
                              markUnsaved("company");
                            }}
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
                            placeholder="+356 99123456 or +44 7700 900000"
                            value={companySettings.phone}
                            className={validationErrors.company_phone ? "border-destructive" : ""}
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, phone: e.target.value });
                              markUnsaved("company");
                            }}
                          />
                          {validationErrors.company_phone ? (
                            <p className="text-xs text-destructive">{validationErrors.company_phone}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Include country code, e.g. +356 for Malta</p>
                          )}
                        </div>

                        {/* FIX: website field now visible in UI */}
                        <div className="space-y-2">
                          <Label htmlFor="company_website" className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Website
                          </Label>
                          <Input
                            id="company_website"
                            placeholder="https://www.yourcompany.com"
                            value={companySettings.website}
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, website: e.target.value });
                              markUnsaved("company");
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Shown on public invoice view as a clickable link
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="company_vat_number">
                            VAT Number{" "}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <InfoIcon className="h-3 w-3 text-muted-foreground inline" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Malta: MT12345678 (MT + 8 digits). Leave blank if exempt.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <Input
                            id="company_vat_number"
                            placeholder="MT12345678"
                            value={companySettings.taxId}
                            className={validationErrors.company_vat ? "border-destructive" : ""}
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, taxId: e.target.value });
                              markUnsaved("company");
                            }}
                          />
                          {validationErrors.company_vat ? (
                            <p className="text-xs text-destructive">{validationErrors.company_vat}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Optional — leave blank if exempt</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="company_registration">Registration Number</Label>
                          <Input
                            id="company_registration"
                            placeholder="C12345"
                            value={companySettings.registrationNumber}
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, registrationNumber: e.target.value });
                              markUnsaved("company");
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="company_address_line1" className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            House Name / Number
                          </Label>
                          <Input
                            id="company_address_line1"
                            placeholder="e.g. 123 or Villa Rosa"
                            value={companySettings.addressLine1}
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, addressLine1: e.target.value });
                              markUnsaved("company");
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="company_address_line2">Street Name</Label>
                          <Input
                            id="company_address_line2"
                            placeholder="e.g. Republic Street"
                            value={companySettings.addressLine2}
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, addressLine2: e.target.value });
                              markUnsaved("company");
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="company_locality">Locality</Label>
                          <Input
                            id="company_locality"
                            placeholder="e.g. Valletta"
                            value={companySettings.locality}
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, locality: e.target.value });
                              markUnsaved("company");
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="company_post_code">Post Code</Label>
                          <Input
                            id="company_post_code"
                            placeholder="e.g. VLT 1234"
                            value={companySettings.postCode}
                            onChange={(e) => {
                              setCompanySettings({ ...companySettings, postCode: e.target.value });
                              markUnsaved("company");
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CreditCard className="h-4 w-4" />
                        Default Currency
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="max-w-xs">
                        <Select
                          value={companySettings.defaultCurrency}
                          onValueChange={(v) => {
                            setCompanySettings({ ...companySettings, defaultCurrency: v });
                            markUnsaved("company");
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                          </SelectContent>
                        </Select>
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

              {/* ── Banking Tab ── */}
              <TabsContent value="banking">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Primary Bank Account
                      </CardTitle>
                      <CardDescription>Bank account details that appear on invoices</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="bank_name">Bank Name</Label>
                          <Input
                            id="bank_name"
                            placeholder="e.g., Bank of Valletta"
                            value={bankingSettings.bankName}
                            onChange={(e) => {
                              setBankingSettings({ ...bankingSettings, bankName: e.target.value });
                              markUnsaved("banking");
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bank_account_name">Account Holder Name</Label>
                          <Input
                            id="bank_account_name"
                            placeholder="Your Company Ltd"
                            value={bankingSettings.accountName}
                            onChange={(e) => {
                              setBankingSettings({ ...bankingSettings, accountName: e.target.value });
                              markUnsaved("banking");
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bank_iban">
                            IBAN{" "}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <InfoIcon className="h-3 w-3 text-muted-foreground inline" />
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
                            className={validationErrors.banking_iban ? "border-destructive" : ""}
                            onChange={(e) => {
                              setBankingSettings({ ...bankingSettings, iban: e.target.value });
                              markUnsaved("banking");
                            }}
                          />
                          {validationErrors.banking_iban ? (
                            <p className="text-xs text-destructive">{validationErrors.banking_iban}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">2 letters, 2 digits, up to 30 alphanumeric</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bank_swift">SWIFT / BIC Code</Label>
                          <Input
                            id="bank_swift"
                            placeholder="VALLMTMT"
                            value={bankingSettings.swiftCode}
                            onChange={(e) => {
                              setBankingSettings({ ...bankingSettings, swiftCode: e.target.value });
                              markUnsaved("banking");
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <SettingsIcon className="h-5 w-5" />
                        Banking Preferences
                      </CardTitle>
                      <CardDescription>Control how banking information appears on invoices</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="include_banking">Show bank details on invoices</Label>
                          <p className="text-sm text-muted-foreground">
                            Display your bank account on generated invoices
                          </p>
                        </div>
                        <Switch
                          id="include_banking"
                          checked={bankingPreferences.includeBankingOnInvoices}
                          onCheckedChange={(v) => {
                            setBankingPreferences({ ...bankingPreferences, includeBankingOnInvoices: v });
                            markUnsaved("banking");
                          }}
                        />
                      </div>

                      {bankingPreferences.includeBankingOnInvoices && (
                        <div className="space-y-2">
                          <Label htmlFor="banking_format">Display Format</Label>
                          <Select
                            value={bankingPreferences.bankingDisplayFormat}
                            onValueChange={(v) => {
                              setBankingPreferences({ ...bankingPreferences, bankingDisplayFormat: v });
                              markUnsaved("banking");
                            }}
                          >
                            <SelectTrigger id="banking_format">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">Full details (Bank, IBAN, SWIFT)</SelectItem>
                              <SelectItem value="iban">IBAN only</SelectItem>
                              <SelectItem value="custom">Custom (editable in template)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

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

              {/* ── Invoice Tab ── */}
              <TabsContent value="invoice">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Palette className="h-4 w-4" />
                        Numbering &amp; Terms
                      </CardTitle>
                      <CardDescription>Invoice numbering, prefixes, and payment terms</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="numbering_prefix">Invoice Prefix</Label>
                          <Input
                            id="numbering_prefix"
                            placeholder="INV-"
                            value={invoiceSettings.prefix}
                            onChange={(e) => {
                              setInvoiceSettings({ ...invoiceSettings, prefix: e.target.value });
                              markUnsaved("invoice");
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Preview:{" "}
                            <span className="font-mono font-medium text-foreground">
                              {invoiceSettings.prefix || "INV-"}
                              {new Date().getFullYear()}-{String(invoiceSettings.nextNumber).padStart(3, "0")}
                            </span>
                          </p>
                        </div>

                        {/* FIX: next number editable only before first invoice is created */}
                        <div className="space-y-2">
                          <Label htmlFor="next_invoice_number">Next Number</Label>
                          <Input
                            id="next_invoice_number"
                            type="number"
                            min="1"
                            value={invoiceSettings.nextNumber}
                            disabled={!invoiceSettings.isFirstInvoice}
                            className={!invoiceSettings.isFirstInvoice ? "bg-muted" : ""}
                            onChange={(e) => {
                              if (!invoiceSettings.isFirstInvoice) return;
                              setInvoiceSettings({ ...invoiceSettings, nextNumber: parseInt(e.target.value) || 1 });
                              markUnsaved("invoice");
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            {invoiceSettings.isFirstInvoice
                              ? "Set your starting number before creating your first invoice — cannot be changed after."
                              : "Auto-increments with each invoice — locked after first invoice is created."}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="default_payment_days">Default Payment Terms</Label>
                          <Select
                            value={invoiceSettings.defaultPaymentTerms.toString()}
                            onValueChange={(v) => {
                              setInvoiceSettings({ ...invoiceSettings, defaultPaymentTerms: parseInt(v) });
                              markUnsaved("invoice");
                            }}
                          >
                            <SelectTrigger id="default_payment_days">
                              <SelectValue />
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
                          <p className="text-xs text-muted-foreground">
                            Used when a customer has no specific terms set
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="late_payment_interest">Late Payment Interest (%)</Label>
                          <Input
                            id="late_payment_interest"
                            type="number"
                            min="0"
                            max="20"
                            step="0.1"
                            value={invoiceSettings.latePaymentInterestRate}
                            onChange={(e) => {
                              setInvoiceSettings({
                                ...invoiceSettings,
                                latePaymentInterestRate: parseFloat(e.target.value),
                              });
                              markUnsaved("invoice");
                            }}
                          />
                          <p className="text-xs text-muted-foreground">EU Late Payment Directive default: 8%</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="early_payment_discount">Early Payment Discount (%)</Label>
                          <Input
                            id="early_payment_discount"
                            type="number"
                            min="0"
                            max="20"
                            step="0.1"
                            value={invoiceSettings.earlyPaymentDiscountRate}
                            onChange={(e) => {
                              setInvoiceSettings({
                                ...invoiceSettings,
                                earlyPaymentDiscountRate: parseFloat(e.target.value),
                              });
                              markUnsaved("invoice");
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="early_payment_days">Early Payment Period (Days)</Label>
                          <Input
                            id="early_payment_days"
                            type="number"
                            min="0"
                            max="30"
                            value={invoiceSettings.earlyPaymentDiscountDays}
                            onChange={(e) => {
                              setInvoiceSettings({
                                ...invoiceSettings,
                                earlyPaymentDiscountDays: parseInt(e.target.value),
                              });
                              markUnsaved("invoice");
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <SettingsIcon className="h-4 w-4" />
                        Document Content
                      </CardTitle>
                      <CardDescription>Default text that appears on invoices and quotations</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="invoice_footer">Invoice Footer</Label>
                        <Textarea
                          id="invoice_footer"
                          rows={2}
                          placeholder="Thank you for your business"
                          value={invoiceSettings.footer}
                          onChange={(e) => {
                            setInvoiceSettings({ ...invoiceSettings, footer: e.target.value });
                            markUnsaved("invoice");
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice_notes">Default Invoice Notes</Label>
                        <p className="text-xs text-muted-foreground">
                          Auto-populates on new invoices. Editable per invoice.
                        </p>
                        <Textarea
                          id="invoice_notes"
                          rows={2}
                          placeholder="Payment due within 30 days. Late payments subject to interest per EU Directive 2011/7/EU."
                          value={invoiceSettings.notes}
                          onChange={(e) => {
                            setInvoiceSettings({ ...invoiceSettings, notes: e.target.value });
                            markUnsaved("invoice");
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quotation_terms">Quotation Terms &amp; Conditions</Label>
                        <p className="text-xs text-muted-foreground">
                          Each line becomes a numbered item on quotation PDFs.
                        </p>
                        <Textarea
                          id="quotation_terms"
                          rows={3}
                          placeholder={`This quotation is valid until the date shown above.\nWork will commence upon acceptance.\nAny additional services will be quoted separately.`}
                          value={invoiceSettings.quotationTerms}
                          onChange={(e) => {
                            setInvoiceSettings({ ...invoiceSettings, quotationTerms: e.target.value });
                            markUnsaved("invoice");
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <Label htmlFor="payment_instructions">Include Payment Instructions</Label>
                          <p className="text-xs text-muted-foreground">Show banking details on invoices</p>
                        </div>
                        <Switch
                          id="payment_instructions"
                          checked={invoiceSettings.includePaymentInstructions}
                          onCheckedChange={(v) => {
                            setInvoiceSettings({ ...invoiceSettings, includePaymentInstructions: v });
                            markUnsaved("invoice");
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Shield className="h-4 w-4" />
                        VAT &amp; Compliance
                      </CardTitle>
                      <CardDescription>VAT rates and EU compliance settings</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="vat_standard">Standard VAT Rate (%)</Label>
                          <Input
                            id="vat_standard"
                            type="number"
                            min="0"
                            max="27"
                            step="0.1"
                            value={invoiceSettings.vatRateStandard}
                            onChange={(e) => {
                              setInvoiceSettings({ ...invoiceSettings, vatRateStandard: parseFloat(e.target.value) });
                              markUnsaved("invoice");
                            }}
                          />
                          <p className="text-xs text-muted-foreground">Malta: 18%</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vat_reduced">Reduced VAT Rate (%)</Label>
                          <Input
                            id="vat_reduced"
                            type="number"
                            min="0"
                            max="27"
                            step="0.1"
                            value={invoiceSettings.vatRateReduced}
                            onChange={(e) => {
                              setInvoiceSettings({ ...invoiceSettings, vatRateReduced: parseFloat(e.target.value) });
                              markUnsaved("invoice");
                            }}
                          />
                          <p className="text-xs text-muted-foreground">Malta: 5%</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <Label htmlFor="vat_breakdown">Show VAT Breakdown</Label>
                          <p className="text-xs text-muted-foreground">
                            Per-rate VAT summary on invoices (recommended for B2B)
                          </p>
                        </div>
                        <Switch
                          id="vat_breakdown"
                          checked={invoiceSettings.includeVatBreakdown}
                          onCheckedChange={(v) => {
                            setInvoiceSettings({ ...invoiceSettings, includeVatBreakdown: v });
                            markUnsaved("invoice");
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reverse_charge">Reverse Charge Text</Label>
                        <Textarea
                          id="reverse_charge"
                          rows={2}
                          value={invoiceSettings.reverseChargeNote}
                          onChange={(e) => {
                            setInvoiceSettings({ ...invoiceSettings, reverseChargeNote: e.target.value });
                            markUnsaved("invoice");
                          }}
                        />
                        <p className="text-xs text-muted-foreground">For B2B EU cross-border transactions</p>
                      </div>

                      <Separator />

                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Advanced EU Cross-Border Settings
                          </span>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="supply_place">Default Place of Supply</Label>
                              <Select
                                value={invoiceSettings.defaultSupplyPlace}
                                onValueChange={(v) => {
                                  setInvoiceSettings({ ...invoiceSettings, defaultSupplyPlace: v });
                                  markUnsaved("invoice");
                                }}
                              >
                                <SelectTrigger id="supply_place">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="malta">Malta</SelectItem>
                                  <SelectItem value="customer">Customer Location</SelectItem>
                                  <SelectItem value="performance">Performance Location</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="invoice_language">Invoice Language</Label>
                              <Select
                                value={invoiceSettings.invoiceLanguage}
                                onValueChange={(v) => {
                                  setInvoiceSettings({ ...invoiceSettings, invoiceLanguage: v });
                                  markUnsaved("invoice");
                                }}
                              >
                                <SelectTrigger id="invoice_language">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="en">English</SelectItem>
                                  <SelectItem value="mt">Maltese</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="intrastat_threshold">Intrastat Threshold (€)</Label>
                              <Input
                                id="intrastat_threshold"
                                type="number"
                                min="0"
                                value={invoiceSettings.intrastatThreshold}
                                onChange={(e) => {
                                  setInvoiceSettings({
                                    ...invoiceSettings,
                                    intrastatThreshold: parseFloat(e.target.value),
                                  });
                                  markUnsaved("invoice");
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="distance_selling">Distance Selling Threshold (€)</Label>
                              <Input
                                id="distance_selling"
                                type="number"
                                min="0"
                                value={invoiceSettings.distanceSellingThreshold}
                                onChange={(e) => {
                                  setInvoiceSettings({
                                    ...invoiceSettings,
                                    distanceSellingThreshold: parseFloat(e.target.value),
                                  });
                                  markUnsaved("invoice");
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <Label htmlFor="eori_number">Include EORI Number</Label>
                            <Switch
                              id="eori_number"
                              checked={invoiceSettings.includeEoriNumber}
                              onCheckedChange={(v) => {
                                setInvoiceSettings({ ...invoiceSettings, includeEoriNumber: v });
                                markUnsaved("invoice");
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <Label htmlFor="moss_eligible">MOSS / OSS Eligible</Label>
                            <Switch
                              id="moss_eligible"
                              checked={invoiceSettings.euVatMossEligible}
                              onCheckedChange={(v) => {
                                setInvoiceSettings({ ...invoiceSettings, euVatMossEligible: v });
                                markUnsaved("invoice");
                              }}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

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

              {/* ── Notifications Tab ── */}
              <TabsContent value="notifications">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Email Notifications
                      </CardTitle>
                      <CardDescription>Choose which email notifications you want to receive</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {[
                        {
                          id: "email_reminders",
                          label: "Payment Reminders",
                          desc: "Send email reminders for overdue invoices",
                          key: "emailReminders" as const,
                        },
                        {
                          id: "payment_notifications",
                          label: "Payment Received",
                          desc: "Get notified when payments are received",
                          key: "paymentNotifications" as const,
                        },
                        {
                          id: "overdue_alerts",
                          label: "Overdue Alerts",
                          desc: "Daily alerts for overdue invoices",
                          key: "overdueAlerts" as const,
                        },
                        {
                          id: "weekly_reports",
                          label: "Weekly Reports",
                          desc: "Weekly summary of invoices and payments",
                          key: "weeklyReports" as const,
                        },
                        {
                          id: "customer_communications",
                          label: "Customer Updates",
                          desc: "Notifications when customers view/download invoices",
                          key: "customerCommunications" as const,
                        },
                      ].map((item, idx) => (
                        <div key={item.id}>
                          {idx > 0 && <Separator className="mb-4" />}
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor={item.id}>{item.label}</Label>
                              <p className="text-sm text-muted-foreground">{item.desc}</p>
                            </div>
                            <Switch
                              id={item.id}
                              checked={notificationSettings[item.key]}
                              onCheckedChange={(v) => {
                                setNotificationSettings({ ...notificationSettings, [item.key]: v });
                                markUnsaved("notifications");
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Reminder Schedule
                      </CardTitle>
                      <CardDescription>Configure when payment reminders are sent for overdue invoices</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          {
                            id: "first_reminder",
                            label: "First Reminder",
                            key: "firstReminderDays" as const,
                            options: [
                              ["3", "3 days after due date"],
                              ["7", "7 days after due date"],
                              ["14", "14 days after due date"],
                            ],
                          },
                          {
                            id: "second_reminder",
                            label: "Second Reminder",
                            key: "secondReminderDays" as const,
                            options: [
                              ["7", "7 days after 1st reminder"],
                              ["14", "14 days after 1st reminder"],
                              ["21", "21 days after 1st reminder"],
                            ],
                          },
                          {
                            id: "final_notice",
                            label: "Final Notice",
                            key: "finalNoticeDays" as const,
                            options: [
                              ["14", "14 days after 2nd reminder"],
                              ["21", "21 days after 2nd reminder"],
                              ["30", "30 days after 2nd reminder"],
                            ],
                          },
                        ].map((item) => (
                          <div key={item.id} className="space-y-2">
                            <Label htmlFor={item.id}>{item.label}</Label>
                            <Select
                              value={notificationSettings[item.key].toString()}
                              onValueChange={(v) => {
                                setNotificationSettings({ ...notificationSettings, [item.key]: parseInt(v) });
                                markUnsaved("notifications");
                              }}
                            >
                              <SelectTrigger id={item.id}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {item.options.map(([val, label]) => (
                                  <SelectItem key={val} value={val}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>

                      <Alert>
                        <InfoIcon className="h-4 w-4" />
                        <AlertDescription>
                          Automated reminders help maintain healthy cash flow. Customers receive polite reminders at the
                          intervals set above.
                        </AlertDescription>
                      </Alert>

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

              {/* ── Preferences Tab ── */}
              <TabsContent value="preferences">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Display Settings
                      </CardTitle>
                      <CardDescription>Customize the appearance and language of the application</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="theme">Theme</Label>
                          <Select
                            value={preferenceSettings.theme}
                            onValueChange={(v) => {
                              setPreferenceSettings({ ...preferenceSettings, theme: v });
                              markUnsaved("preferences");
                            }}
                          >
                            <SelectTrigger id="theme">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="language">Language</Label>
                          <Select
                            value={preferenceSettings.language}
                            onValueChange={(v) => {
                              setPreferenceSettings({ ...preferenceSettings, language: v });
                              markUnsaved("preferences");
                            }}
                          >
                            <SelectTrigger id="language">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="mt">Maltese (Coming Soon)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="date_format">Date Format</Label>
                          <Select
                            value={preferenceSettings.dateFormat}
                            onValueChange={(v) => {
                              setPreferenceSettings({ ...preferenceSettings, dateFormat: v });
                              markUnsaved("preferences");
                            }}
                          >
                            <SelectTrigger id="date_format">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</SelectItem>
                              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</SelectItem>
                              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="time_format">Time Format</Label>
                          <Select
                            value={preferenceSettings.timeFormat}
                            onValueChange={(v) => {
                              setPreferenceSettings({ ...preferenceSettings, timeFormat: v });
                              markUnsaved("preferences");
                            }}
                          >
                            <SelectTrigger id="time_format">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="24h">24-hour (14:30)</SelectItem>
                              <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Currency Display
                      </CardTitle>
                      <CardDescription>Customize how currency values are formatted</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="currency_symbol">Currency Display</Label>
                          <Select
                            value={preferenceSettings.currencySymbolDisplay}
                            onValueChange={(v) => {
                              setPreferenceSettings({ ...preferenceSettings, currencySymbolDisplay: v });
                              markUnsaved("preferences");
                            }}
                          >
                            <SelectTrigger id="currency_symbol">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="symbol">Symbol (€)</SelectItem>
                              <SelectItem value="code">Code (EUR)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="currency_position">Currency Position</Label>
                          <Select
                            value={preferenceSettings.currencyPosition}
                            onValueChange={(v) => {
                              setPreferenceSettings({ ...preferenceSettings, currencyPosition: v });
                              markUnsaved("preferences");
                            }}
                          >
                            <SelectTrigger id="currency_position">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="before">Before amount (€100.00)</SelectItem>
                              <SelectItem value="after">After amount (100.00€)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-4 border border-border">
                        <p className="text-sm text-muted-foreground">
                          Preview:{" "}
                          {preferenceSettings.currencyPosition === "before"
                            ? `${preferenceSettings.currencySymbolDisplay === "symbol" ? "€" : "EUR"} 1,234.56`
                            : `1,234.56 ${preferenceSettings.currencySymbolDisplay === "symbol" ? "€" : "EUR"}`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <SettingsIcon className="h-5 w-5" />
                        Data Display
                      </CardTitle>
                      <CardDescription>Control how data is displayed in lists and tables</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="items_per_page">Items per Page</Label>
                          <Select
                            value={preferenceSettings.itemsPerPage.toString()}
                            onValueChange={(v) => {
                              setPreferenceSettings({ ...preferenceSettings, itemsPerPage: parseInt(v) });
                              markUnsaved("preferences");
                            }}
                          >
                            <SelectTrigger id="items_per_page">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10 items</SelectItem>
                              <SelectItem value="25">25 items</SelectItem>
                              <SelectItem value="50">50 items</SelectItem>
                              <SelectItem value="100">100 items</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="default_view">Default List View</Label>
                          <Select
                            value={preferenceSettings.defaultView}
                            onValueChange={(v) => {
                              setPreferenceSettings({ ...preferenceSettings, defaultView: v });
                              markUnsaved("preferences");
                            }}
                          >
                            <SelectTrigger id="default_view">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="table">Table View</SelectItem>
                              <SelectItem value="cards">Cards View</SelectItem>
                            </SelectContent>
                          </Select>
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
