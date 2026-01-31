import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDefaultTemplate, InvoiceTemplate } from '@/services/templateService';

const TEMPLATE_QUERY_KEY = ['invoiceTemplate'];

interface UseInvoiceTemplateReturn {
  template: InvoiceTemplate | null;
  isLoading: boolean;
  error: string | null;
  refreshTemplate: () => Promise<void>;
}

/**
 * Unified hook for loading and managing invoice templates
 * Uses React Query for global cache invalidation across all components
 */
export const useInvoiceTemplate = (): UseInvoiceTemplateReturn => {
  const queryClient = useQueryClient();

  const { data: template, isLoading, error } = useQuery({
    queryKey: TEMPLATE_QUERY_KEY,
    queryFn: async () => {
      console.log('[useInvoiceTemplate] Loading template...');
      const loadedTemplate = await getDefaultTemplate();
      console.log('[useInvoiceTemplate] Template loaded:', loadedTemplate);
      
      // Validate template has required fields
      if (!loadedTemplate.primary_color || !loadedTemplate.accent_color) {
        console.warn('[useInvoiceTemplate] Template missing required color fields, using defaults');
      }
      
      // Normalize template with defaults
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
        banking_visibility: loadedTemplate.banking_visibility ?? true,
        banking_style: loadedTemplate.banking_style || 'default',
        vat_summary_visibility: loadedTemplate.vat_summary_visibility ?? false,
        margin_top: loadedTemplate.margin_top ?? 20,
        margin_right: loadedTemplate.margin_right ?? 20,
        margin_bottom: loadedTemplate.margin_bottom ?? 20,
        margin_left: loadedTemplate.margin_left ?? 20,
      } as InvoiceTemplate;
      
      console.log('[useInvoiceTemplate] Normalized template:', normalizedTemplate);
      return normalizedTemplate;
    },
    staleTime: 0, // Always check for fresh data
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // This function invalidates the cache globally
  const refreshTemplate = async () => {
    console.log('[useInvoiceTemplate] Invalidating template cache...');
    await queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEY });
  };

  return {
    template: template ?? null,
    isLoading,
    error: error ? String(error) : null,
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
