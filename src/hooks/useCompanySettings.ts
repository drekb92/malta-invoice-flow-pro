import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CompanySettings {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_website?: string;
  company_address?: string;
  company_city?: string;
  company_state?: string;
  company_zip_code?: string;
  company_country?: string;
  company_vat_number?: string;
  company_registration_number?: string;
  company_logo?: string;
  currency_code?: string;
  default_payment_terms?: number;
  invoice_prefix?: string;
  quotation_prefix?: string;
}

export interface BankingDetails {
  bank_name?: string;
  bank_account_name?: string;
  bank_iban?: string;
  bank_swift_code?: string;
  include_on_invoices?: boolean;
  display_format?: string;
}

export interface InvoiceSettings {
  numbering_prefix?: string;
  next_invoice_number?: number;
  default_payment_days?: number;
  late_payment_interest_rate?: number;
  vat_rate_standard?: number;
  vat_rate_reduced?: number;
  invoice_language?: string;
  include_vat_breakdown?: boolean;
  invoice_footer_text?: string;
  default_invoice_notes?: string;
}

export interface AllSettings {
  company: CompanySettings | null;
  banking: BankingDetails | null;
  invoice: InvoiceSettings | null;
}

export const useCompanySettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AllSettings>({
    company: null,
    banking: null,
    invoice: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load company settings
      const { data: companyData, error: companyError } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (companyError && companyError.code !== 'PGRST116') throw companyError;

      // Load banking details
      const { data: bankingData, error: bankingError } = await supabase
        .from('banking_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (bankingError && bankingError.code !== 'PGRST116') throw bankingError;

      // Load invoice settings
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (invoiceError && invoiceError.code !== 'PGRST116') throw invoiceError;

      setSettings({
        company: companyData,
        banking: bankingData,
        invoice: invoiceData,
      });
    } catch (err) {
      console.error('Error loading company settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to load settings'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    error,
    refreshSettings: loadSettings,
  };
};
