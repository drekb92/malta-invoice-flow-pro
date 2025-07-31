import { supabase } from "@/integrations/supabase/client";

export interface InvoiceTemplate {
  id: string;
  name: string;
  is_default: boolean;
  logo_url?: string;
  primary_color: string;
  accent_color: string;
  font_family: string;
  font_size: string;
  logo_x_offset: number;
  logo_y_offset: number;
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
        logo_x_offset: 0,
        logo_y_offset: 0,
      };
    }

    return data;
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
      logo_x_offset: 0,
      logo_y_offset: 0,
    };
  }
};