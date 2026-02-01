import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface InvoiceSettings {
  id: string;
  user_id: string;
  invoice_footer_text?: string;
  default_invoice_notes?: string;
  reverse_charge_note?: string;
  default_payment_days?: number;
  numbering_prefix?: string;
  invoice_language?: string;
  vat_rate_standard?: number;
  vat_rate_reduced?: number;
  vat_rate_zero?: number;
  include_vat_breakdown?: boolean;
  include_payment_instructions?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface UseInvoiceSettingsReturn {
  settings: InvoiceSettings | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to load invoice settings from the database
 * Provides access to invoice-related configuration like footer text, notes, etc.
 */
export const useInvoiceSettings = (): UseInvoiceSettingsReturn => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setSettings(data as InvoiceSettings);
      } else {
        // No settings yet - that's fine, will use defaults
        setSettings(null);
      }
    } catch (err) {
      console.error('[useInvoiceSettings] Error loading settings:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load invoice settings';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const refresh = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    error,
    refresh,
  };
};
