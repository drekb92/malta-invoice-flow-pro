import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import type {
  InvoiceData,
  CompanySettings,
  BankingSettings,
  TemplateSettings,
} from "@/components/UnifiedInvoiceLayout";

export interface InvoicePdfDataResult {
  invoiceData: InvoiceData;
  companySettings: CompanySettings;
  bankingSettings: BankingSettings;
  templateSettings: TemplateSettings;
  footerText?: string;
}

/**
 * Hook to fetch all data needed to render an invoice for PDF generation.
 * Used by SendDocumentEmailDialog when no preview DOM element exists.
 */
export function useInvoicePdfData(invoiceId: string | null, enabled: boolean) {
  const { settings: companySettingsRaw, isLoading: companyLoading } = useCompanySettings();
  const { settings: bankingSettingsRaw, isLoading: bankingLoading } = useBankingSettings();
  const { template, isLoading: templateLoading } = useInvoiceTemplate();

  // Fetch invoice with customer
  const {
    data: invoiceWithCustomer,
    isLoading: invoiceLoading,
    error: invoiceError,
  } = useQuery({
    queryKey: ["invoice-pdf-data", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;

      const { data: invoice, error: invoiceErr } = await supabase
        .from("invoices")
        .select(`
          *,
          customer:customers(*)
        `)
        .eq("id", invoiceId)
        .single();

      if (invoiceErr) throw invoiceErr;
      return invoice;
    },
    enabled: enabled && !!invoiceId,
  });

  // Fetch invoice items
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["invoice-items-pdf", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];

      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!invoiceId,
  });

  // Fetch invoice settings for footer text
  const { data: invoiceSettings } = useQuery({
    queryKey: ["invoice-settings-pdf"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_settings")
        .select("invoice_footer_text")
        .single();
      return data;
    },
    enabled,
  });

  const isLoading =
    invoiceLoading ||
    itemsLoading ||
    companyLoading ||
    bankingLoading ||
    templateLoading;

  // Build the result only when all data is available
  let data: InvoicePdfDataResult | null = null;

  if (!isLoading && invoiceWithCustomer && items) {
    const invoice = invoiceWithCustomer;
    const customer = invoice.customer;

    // Calculate totals from items
    const netTotal = items.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
      0
    );
    const vatTotal = items.reduce(
      (sum, item) =>
        sum + (item.quantity || 0) * (item.unit_price || 0) * (item.vat_rate || 0),
      0
    );
    const grandTotal = netTotal + vatTotal;

    // Map to InvoiceData format
    const invoiceData: InvoiceData = {
      invoiceNumber: invoice.invoice_number || "",
      invoiceDate: invoice.invoice_date || "",
      dueDate: invoice.due_date || "",
      customer: {
        name: customer?.name || "",
        email: customer?.email || undefined,
        address: customer?.address || undefined,
        address_line1: customer?.address_line1 || undefined,
        address_line2: customer?.address_line2 || undefined,
        locality: customer?.locality || undefined,
        post_code: customer?.post_code || undefined,
        vat_number: customer?.vat_number || undefined,
      },
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity || 0,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate || 0,
        unit: item.unit || undefined,
      })),
      totals: {
        netTotal,
        vatTotal,
        grandTotal,
      },
      discount:
        invoice.discount_value && invoice.discount_value > 0
          ? {
              type: (invoice.discount_type as "amount" | "percent") || "amount",
              value: invoice.discount_value,
              amount:
                invoice.discount_type === "percent"
                  ? netTotal * (invoice.discount_value / 100)
                  : invoice.discount_value,
            }
          : undefined,
    };

    // Map company settings
    const companySettings: CompanySettings = {
      name: companySettingsRaw?.company_name || undefined,
      email: companySettingsRaw?.company_email || undefined,
      phone: companySettingsRaw?.company_phone || undefined,
      address: companySettingsRaw?.company_address || undefined,
      addressLine1: companySettingsRaw?.company_address_line1 || undefined,
      addressLine2: companySettingsRaw?.company_address_line2 || undefined,
      locality: companySettingsRaw?.company_locality || undefined,
      postCode: companySettingsRaw?.company_post_code || undefined,
      city: companySettingsRaw?.company_city || undefined,
      state: companySettingsRaw?.company_state || undefined,
      zipCode: companySettingsRaw?.company_zip_code || undefined,
      country: companySettingsRaw?.company_country || undefined,
      taxId: companySettingsRaw?.company_vat_number || undefined,
      registrationNumber: companySettingsRaw?.company_registration_number || undefined,
      logo: companySettingsRaw?.company_logo || undefined,
    };

    // Map banking settings
    const bankingSettings: BankingSettings = {
      bankName: bankingSettingsRaw?.bank_name || undefined,
      accountName: bankingSettingsRaw?.bank_account_name || undefined,
      swiftCode: bankingSettingsRaw?.bank_swift_code || undefined,
      iban: bankingSettingsRaw?.bank_iban || undefined,
    };

    // Map template settings
    const templateSettings: TemplateSettings = {
      primaryColor: template?.primary_color || undefined,
      accentColor: template?.accent_color || undefined,
      fontFamily: template?.font_family || undefined,
      fontSize: template?.font_size || undefined,
      layout: template?.layout || undefined,
      headerLayout: template?.header_layout || undefined,
      tableStyle: template?.table_style || undefined,
      totalsStyle: template?.totals_style || undefined,
      bankingVisibility: template?.banking_visibility ?? true,
      bankingStyle: template?.banking_style || undefined,
      style: (template?.style as "modern" | "professional" | "minimalist") || "modern",
    };

    data = {
      invoiceData,
      companySettings,
      bankingSettings,
      templateSettings,
      footerText: invoiceSettings?.invoice_footer_text || undefined,
    };
  }

  return {
    data,
    isLoading,
    isReady: !isLoading && !!data,
    error: invoiceError,
  };
}
