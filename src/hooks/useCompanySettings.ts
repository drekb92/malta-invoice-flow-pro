import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface CompanySettings {
  id: string;
  user_id: string;
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_address_line1?: string;
  company_address_line2?: string;
  company_locality?: string;
  company_post_code?: string;
  company_city?: string;
  company_state?: string;
  company_zip_code?: string;
  company_country?: string;
  company_vat_number?: string;
  company_registration_number?: string;
  company_logo?: string;
  company_website?: string;
  invoice_prefix: string;
  quotation_prefix: string;
  default_payment_terms: number;
  currency_code: string;
  created_at?: string;
  updated_at?: string;
}

interface UseCompanySettingsReturn {
  settings: CompanySettings | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Hook to load and manage company settings from the database
 * Provides consistent access to company information across components
 */
export const useCompanySettings = (userId?: string): UseCompanySettingsReturn => {
  const { user } = useAuth();
  const { toast } = useToast();
  const effectiveUserId = userId || user?.id;
  
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validateSettings = useCallback((settings: CompanySettings | null): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!settings) {
      return { isValid: false, errors: ['Company settings not loaded'] };
    }

    // Required fields for invoices
    if (!settings.company_name || settings.company_name.trim() === '') {
      errors.push('Company name is required');
    }

    // Validate email format if provided
    if (settings.company_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(settings.company_email)) {
        errors.push('Invalid company email format');
      }
    }

    // Validate VAT number format if provided (basic check)
    if (settings.company_vat_number) {
      const vatRegex = /^[A-Z]{2}[\dA-Z]+$/;
      if (!vatRegex.test(settings.company_vat_number.replace(/\s/g, ''))) {
        errors.push('Invalid VAT number format (should start with country code)');
      }
    }

    // Warn if address is incomplete
    if (settings.company_address && (!settings.company_city || !settings.company_country)) {
      errors.push('Address is incomplete (missing city or country)');
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  const loadSettings = useCallback(async () => {
    if (!effectiveUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setSettings(data as CompanySettings);
      } else {
        // No company settings yet - create default entry
        const defaultSettings = {
          user_id: effectiveUserId,
          invoice_prefix: 'INV-',
          quotation_prefix: 'QUO-',
          default_payment_terms: 30,
          currency_code: 'EUR',
        };

        const { data: newData, error: insertError } = await supabase
          .from('company_settings')
          .insert([defaultSettings])
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newData as CompanySettings);
      }
    } catch (err) {
      console.error('[useCompanySettings] Error loading settings:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load company settings';
      setError(errorMessage);
      
      toast({
        title: 'Company Settings Error',
        description: 'Unable to load company information. Please check Settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const refresh = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  const validation = validateSettings(settings);

  return {
    settings,
    isLoading,
    error,
    refresh,
    isValid: validation.isValid,
    validationErrors: validation.errors,
  };
};

/**
 * Format company address for display on invoices
 */
export const formatCompanyAddress = (settings: CompanySettings | null): string[] => {
  if (!settings) return [];

  const lines: string[] = [];

  // Use new structured address fields if available
  if (settings.company_address_line1) {
    lines.push(settings.company_address_line1);
  }
  if (settings.company_address_line2) {
    lines.push(settings.company_address_line2);
  }
  if (settings.company_locality) {
    lines.push(settings.company_locality);
  }
  if (settings.company_post_code) {
    lines.push(settings.company_post_code);
  }

  // Fallback to legacy address if new fields are empty
  if (lines.length === 0 && settings.company_address) {
    lines.push(settings.company_address);
    
    const cityLine = [
      settings.company_city,
      settings.company_state,
      settings.company_zip_code,
    ].filter(Boolean).join(', ');

    if (cityLine) {
      lines.push(cityLine);
    }

    if (settings.company_country) {
      lines.push(settings.company_country);
    }
  }

  return lines;
};

/**
 * Get company logo URL (handles both relative and absolute URLs)
 */
export const getCompanyLogoUrl = (settings: CompanySettings | null): string | undefined => {
  if (!settings?.company_logo) return undefined;

  const logo = settings.company_logo;

  // If already absolute URL, return as-is
  if (logo.startsWith('http://') || logo.startsWith('https://')) {
    return logo;
  }

  // If relative to storage bucket, construct full URL
  if (logo.startsWith('/')) {
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos${logo}`;
  }

  // If just filename, prepend bucket path
  return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${logo}`;
};
