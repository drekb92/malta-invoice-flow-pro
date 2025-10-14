import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface BankingSettings {
  id: string;
  user_id: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_routing_number?: string;
  bank_iban?: string;
  bank_swift_code?: string;
  bank_branch?: string;
  include_on_invoices: boolean;
  display_format: 'full' | 'iban_only' | 'custom';
  created_at?: string;
  updated_at?: string;
}

interface UseBankingSettingsReturn {
  settings: BankingSettings | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Hook to load and manage banking settings from the database
 * Provides consistent access to banking information across components
 */
export const useBankingSettings = (): UseBankingSettingsReturn => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<BankingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validateSettings = useCallback((settings: BankingSettings | null): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!settings) {
      return { isValid: false, errors: ['Banking settings not loaded'] };
    }

    if (!settings.include_on_invoices) {
      // If not included on invoices, validation passes
      return { isValid: true, errors: [] };
    }

    // Validate based on display format
    if (settings.display_format === 'full') {
      if (!settings.bank_name) errors.push('Bank name is required');
      if (!settings.bank_account_name) errors.push('Account name is required');
      if (!settings.bank_iban && !settings.bank_account_number) {
        errors.push('IBAN or account number is required');
      }
    } else if (settings.display_format === 'iban_only') {
      if (!settings.bank_iban) errors.push('IBAN is required for IBAN-only display');
    }

    // Validate IBAN format if provided
    if (settings.bank_iban) {
      const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]+$/;
      if (!ibanRegex.test(settings.bank_iban.replace(/\s/g, ''))) {
        errors.push('Invalid IBAN format');
      }
    }

    // Validate SWIFT code format if provided
    if (settings.bank_swift_code) {
      const swiftRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
      if (!swiftRegex.test(settings.bank_swift_code.replace(/\s/g, ''))) {
        errors.push('Invalid SWIFT/BIC code format');
      }
    }

    return { isValid: errors.length === 0, errors };
  }, []);

  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('banking_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setSettings(data as BankingSettings);
      } else {
        // No banking settings yet - create default entry
        const defaultSettings = {
          user_id: user.id,
          include_on_invoices: true,
          display_format: 'full',
        };

        const { data: newData, error: insertError } = await supabase
          .from('banking_details')
          .insert([defaultSettings])
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newData as BankingSettings);
      }
    } catch (err) {
      console.error('[useBankingSettings] Error loading settings:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load banking settings';
      setError(errorMessage);
      
      toast({
        title: 'Banking Settings Error',
        description: 'Unable to load banking details. Please check Settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

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
 * Format banking details for display on invoices
 */
export const formatBankingDetails = (settings: BankingSettings | null): string[] => {
  if (!settings || !settings.include_on_invoices) {
    return [];
  }

  const lines: string[] = [];

  if (settings.display_format === 'iban_only') {
    if (settings.bank_iban) {
      lines.push(`IBAN: ${settings.bank_iban}`);
    }
  } else if (settings.display_format === 'full') {
    if (settings.bank_name) {
      lines.push(`Bank: ${settings.bank_name}`);
    }
    if (settings.bank_account_name) {
      lines.push(`Account: ${settings.bank_account_name}`);
    }
    if (settings.bank_iban) {
      lines.push(`IBAN: ${settings.bank_iban}`);
    }
    if (settings.bank_swift_code) {
      lines.push(`SWIFT/BIC: ${settings.bank_swift_code}`);
    }
    if (settings.bank_account_number && !settings.bank_iban) {
      lines.push(`Account Number: ${settings.bank_account_number}`);
    }
    if (settings.bank_routing_number) {
      lines.push(`Routing: ${settings.bank_routing_number}`);
    }
    if (settings.bank_branch) {
      lines.push(`Branch: ${settings.bank_branch}`);
    }
  }

  return lines;
};
