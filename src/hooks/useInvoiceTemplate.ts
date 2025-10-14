import { useState, useEffect, useCallback } from 'react';
import { getDefaultTemplate, InvoiceTemplate } from '@/services/templateService';
import { useToast } from '@/hooks/use-toast';

interface UseInvoiceTemplateReturn {
  template: InvoiceTemplate | null;
  isLoading: boolean;
  error: string | null;
  refreshTemplate: () => Promise<void>;
}

/**
 * Unified hook for loading and managing invoice templates
 * Ensures consistent template data across all components
 */
export const useInvoiceTemplate = (): UseInvoiceTemplateReturn => {
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadTemplate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[useInvoiceTemplate] Loading template...');
      const loadedTemplate = await getDefaultTemplate();
      console.log('[useInvoiceTemplate] Template loaded:', loadedTemplate);
      
      // Validate template has required fields
      if (!loadedTemplate.primary_color || !loadedTemplate.accent_color) {
        console.warn('[useInvoiceTemplate] Template missing required color fields, using defaults');
      }
      
      // Ensure consistent font family format and all template fields have defaults
      const normalizedTemplate = {
        ...loadedTemplate,
        font_family: loadedTemplate.font_family || 'Inter',
        font_size: loadedTemplate.font_size || '14px',
        primary_color: loadedTemplate.primary_color || '#26A65B',
        accent_color: loadedTemplate.accent_color || '#1F2D3D',
        layout: loadedTemplate.layout || 'default',
        header_layout: loadedTemplate.header_layout || 'default',
        table_style: loadedTemplate.table_style || 'default',
        totals_style: loadedTemplate.totals_style || 'default',
        banking_visibility: loadedTemplate.banking_visibility !== false,
        banking_style: loadedTemplate.banking_style || 'default',
        margin_top: loadedTemplate.margin_top ?? 20,
        margin_right: loadedTemplate.margin_right ?? 20,
        margin_bottom: loadedTemplate.margin_bottom ?? 20,
        margin_left: loadedTemplate.margin_left ?? 20,
      } as InvoiceTemplate;
      
      console.log('[useInvoiceTemplate] Normalized template:', normalizedTemplate);
      setTemplate(normalizedTemplate);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load template';
      setError(errorMessage);
      console.error('[useInvoiceTemplate] Template loading error:', err);
      
      // Set fallback template to prevent complete failure
      const fallbackTemplate: InvoiceTemplate = {
        id: 'fallback',
        name: 'Fallback Template',
        is_default: true,
        primary_color: '#26A65B',
        accent_color: '#1F2D3D',
        font_family: 'Inter',
        font_size: '14px',
        layout: 'default',
        header_layout: 'default',
        table_style: 'default',
        totals_style: 'default',
        banking_visibility: true,
        banking_style: 'default',
        margin_top: 20,
        margin_right: 20,
        margin_bottom: 20,
        margin_left: 20,
      };
      
      console.log('[useInvoiceTemplate] Using fallback template');
      setTemplate(fallbackTemplate);
      
      toast({
        title: 'Template Loading Warning',
        description: 'Using fallback template. Please check your template settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const refreshTemplate = useCallback(async () => {
    await loadTemplate();
  }, [loadTemplate]);

  return {
    template,
    isLoading,
    error,
    refreshTemplate,
  };
};

/**
 * Validate that template and invoice data are compatible
 */
export const validateTemplateInvoiceData = (
  template: InvoiceTemplate | null,
  invoiceData: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!template) {
    errors.push('Template is required');
  }
  
  if (!invoiceData) {
    errors.push('Invoice data is required');
  }
  
  if (template && invoiceData) {
    // Check required template fields
    if (!template.primary_color) errors.push('Template missing primary color');
    if (!template.accent_color) errors.push('Template missing accent color');
    if (!template.font_family) errors.push('Template missing font family');
    
    // Check required invoice fields
    if (!invoiceData.invoiceNumber) errors.push('Invoice missing number');
    if (!invoiceData.customer?.name) errors.push('Invoice missing customer name');
    if (!invoiceData.items || invoiceData.items.length === 0) {
      errors.push('Invoice missing items');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Normalize invoice data to ensure consistent format for template rendering
 */
export const normalizeInvoiceData = (invoiceData: any) => {
  return {
    ...invoiceData,
    invoiceNumber: invoiceData.invoiceNumber || invoiceData.invoice_number || 'DRAFT',
    invoiceDate: invoiceData.invoiceDate || invoiceData.invoice_date || new Date().toISOString().split('T')[0],
    dueDate: invoiceData.dueDate || invoiceData.due_date || new Date().toISOString().split('T')[0],
    customer: {
      name: invoiceData.customer?.name || invoiceData.customer_name || '',
      email: invoiceData.customer?.email || invoiceData.customer_email || undefined,
      address: invoiceData.customer?.address || invoiceData.customer_address || undefined,
      vat_number: invoiceData.customer?.vat_number || invoiceData.customer_vat_number || undefined,
    },
    items: invoiceData.items || [],
    totals: {
      netTotal: invoiceData.totals?.netTotal || invoiceData.amount || 0,
      vatTotal: invoiceData.totals?.vatTotal || invoiceData.vat_amount || 0,
      grandTotal: invoiceData.totals?.grandTotal || invoiceData.total_amount || 0,
    },
    discount: invoiceData.discount || (invoiceData.discount_amount > 0 ? {
      type: invoiceData.discount_type || 'amount',
      value: invoiceData.discount_value || 0,
      amount: invoiceData.discount_amount || 0,
    } : undefined),
  };
};