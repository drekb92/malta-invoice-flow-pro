import { supabase } from "@/integrations/supabase/client";

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
  company_position?: 'left' | 'right' | 'top-right';
  banking_position?: 'after-totals' | 'bottom' | 'footer';
  margin_top?: number;
  margin_right?: number;
  margin_bottom?: number;
  margin_left?: number;
}

export const getDefaultTemplate = async (): Promise<InvoiceTemplate> => {
  try {
    const { data, error } = await supabase
      .from('invoice_templates')
      .select('*')
      .eq('is_default', true)
      .single();

    if (error || !data) {
      // Return a fallback default template
      return {
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
      };
    }

    // Cast layout to proper type and add defaults for new fields
    return {
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
    };
  } catch (error) {
    console.error('Error fetching default template:', error);
    // Return fallback template
    return {
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
    };
  }
};