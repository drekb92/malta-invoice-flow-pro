import { supabase } from "@/integrations/supabase/client";

// Simplified to 3 core styles: Modern, Professional, Minimalist
export type TemplateStyle = 'modern' | 'professional' | 'minimalist';

export interface InvoiceTemplate {
  id: string;
  name: string;
  is_default: boolean;
  primary_color: string;
  accent_color: string;
  font_family: string;
  font_size: string;
  layout?: 'default' | 'cleanMinimal' | 'compact';
  header_layout?: 'default' | 'centered' | 'split';
  table_style?: 'default' | 'striped' | 'bordered' | 'minimal';
  totals_style?: 'default' | 'boxed' | 'highlighted';
  banking_visibility?: boolean;
  banking_style?: 'default' | 'boxed' | 'minimal';
  vat_summary_visibility?: boolean;
  company_position?: 'left' | 'right' | 'top-right';
  banking_position?: 'after-totals' | 'bottom' | 'footer';
  margin_top?: number;
  margin_right?: number;
  margin_bottom?: number;
  margin_left?: number;
  style?: TemplateStyle;
}

/**
 * Template Style Definitions:
 * 
 * MODERN: Solid brand color header background with white/contrast text.
 *         Bold, contemporary look with colored table headers.
 * 
 * PROFESSIONAL: Clean white header with 4px TOP border in brand color.
 *               Subtle, business-appropriate with minimal color accents.
 * 
 * MINIMALIST: No colored header or borders. Pure white design.
 *             Brand color used ONLY for the Total Amount text.
 * 
 * All styles use standardized font sizes for line items to maintain consistency.
 */
export const getStyleSettings = (style: TemplateStyle): Partial<InvoiceTemplate> => {
  // Standard font for all templates
  const standardFont = 'Inter';
  
  switch (style) {
    case 'modern':
      return {
        font_family: standardFont,
        table_style: 'striped',
        totals_style: 'highlighted',
        banking_style: 'boxed',
      };
    case 'professional':
      return {
        font_family: standardFont,
        table_style: 'default',
        totals_style: 'default',
        banking_style: 'default',
      };
    case 'minimalist':
      return {
        font_family: standardFont,
        table_style: 'minimal',
        totals_style: 'default',
        banking_style: 'minimal',
      };
    default:
      return {
        font_family: standardFont,
      };
  }
};

/**
 * Apply style overrides to a template
 */
export const applyStyleToTemplate = (template: InvoiceTemplate, style: TemplateStyle): InvoiceTemplate => {
  const styleSettings = getStyleSettings(style);
  return {
    ...template,
    ...styleSettings,
    style,
  };
};

export const getDefaultTemplate = async (style?: TemplateStyle): Promise<InvoiceTemplate> => {
  try {
    const { data, error } = await supabase
      .from('invoice_templates')
      .select('*')
      .eq('is_default', true)
      .maybeSingle();

    if (error || !data) {
      // Return a fallback default template
      const fallback: InvoiceTemplate = {
        id: 'default',
        name: 'Default Template',
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
        company_position: 'left',
        banking_position: 'after-totals',
        margin_top: 20,
        margin_right: 20,
        margin_bottom: 20,
        margin_left: 20,
        style: style || 'modern',
      };
      return style ? applyStyleToTemplate(fallback, style) : fallback;
    }

    // Cast layout to proper type and add defaults for new fields
    const template: InvoiceTemplate = {
      ...data,
      layout: (data.layout === 'cleanMinimal' ? 'cleanMinimal' : data.layout === 'compact' ? 'compact' : 'default') as 'default' | 'cleanMinimal' | 'compact',
      header_layout: (data.header_layout || 'default') as 'default' | 'centered' | 'split',
      table_style: (data.table_style || 'default') as 'default' | 'striped' | 'bordered' | 'minimal',
      totals_style: (data.totals_style || 'default') as 'default' | 'boxed' | 'highlighted',
      banking_visibility: data.banking_visibility !== undefined ? data.banking_visibility : true,
      banking_style: (data.banking_style || 'default') as 'default' | 'boxed' | 'minimal',
      company_position: ((data as any).company_position || 'left') as 'left' | 'right' | 'top-right',
      banking_position: ((data as any).banking_position || 'after-totals') as 'after-totals' | 'bottom' | 'footer',
      margin_top: data.margin_top || 20,
      margin_right: data.margin_right || 20,
      margin_bottom: data.margin_bottom || 20,
      margin_left: data.margin_left || 20,
      style: (data.style as TemplateStyle) || 'modern',
    };

    return style ? applyStyleToTemplate(template, style) : template;
  } catch (error) {
    console.error('Error fetching default template:', error);
    // Return fallback template
    const fallback: InvoiceTemplate = {
      id: 'default',
      name: 'Default Template',
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
      company_position: 'left',
      banking_position: 'after-totals',
      margin_top: 20,
      margin_right: 20,
      margin_bottom: 20,
      margin_left: 20,
      style: style || 'modern',
    };
    return style ? applyStyleToTemplate(fallback, style) : fallback;
  }
};