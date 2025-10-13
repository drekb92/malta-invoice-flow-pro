-- Create company_settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_name TEXT,
  company_email TEXT,
  company_phone TEXT,
  company_website TEXT,
  company_address TEXT,
  company_city TEXT,
  company_state TEXT,
  company_zip_code TEXT,
  company_country TEXT,
  company_vat_number TEXT,
  company_registration_number TEXT,
  company_logo TEXT,
  currency_code TEXT DEFAULT 'EUR',
  default_payment_terms INTEGER DEFAULT 30,
  invoice_prefix TEXT DEFAULT 'INV-',
  quotation_prefix TEXT DEFAULT 'QUO-',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create banking_details table
CREATE TABLE IF NOT EXISTS public.banking_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_routing_number TEXT,
  bank_iban TEXT,
  bank_swift_code TEXT,
  bank_branch TEXT,
  include_on_invoices BOOLEAN DEFAULT true,
  display_format TEXT DEFAULT 'full',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create invoice_settings table
CREATE TABLE IF NOT EXISTS public.invoice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  numbering_prefix TEXT DEFAULT 'INV-',
  next_invoice_number INTEGER DEFAULT 1001,
  default_payment_days INTEGER DEFAULT 30,
  late_payment_interest_rate NUMERIC DEFAULT 8.0,
  early_payment_discount_rate NUMERIC DEFAULT 0,
  early_payment_discount_days INTEGER DEFAULT 0,
  invoice_footer_text TEXT,
  default_invoice_notes TEXT,
  include_payment_instructions BOOLEAN DEFAULT true,
  vat_rate_standard NUMERIC DEFAULT 18.0,
  vat_rate_reduced NUMERIC DEFAULT 5.0,
  vat_rate_zero NUMERIC DEFAULT 0,
  invoice_language TEXT DEFAULT 'en',
  include_vat_breakdown BOOLEAN DEFAULT true,
  reverse_charge_note TEXT,
  default_supply_place TEXT DEFAULT 'malta',
  intrastat_threshold NUMERIC DEFAULT 50000,
  distance_selling_threshold NUMERIC DEFAULT 10000,
  include_eori_number BOOLEAN DEFAULT false,
  eu_vat_moss_eligible BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_reminders BOOLEAN DEFAULT true,
  payment_notifications BOOLEAN DEFAULT true,
  overdue_alerts BOOLEAN DEFAULT true,
  weekly_reports BOOLEAN DEFAULT false,
  customer_communications BOOLEAN DEFAULT false,
  first_reminder_days INTEGER DEFAULT 7,
  second_reminder_days INTEGER DEFAULT 14,
  final_notice_days INTEGER DEFAULT 21,
  theme TEXT DEFAULT 'system',
  language TEXT DEFAULT 'en',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  time_format TEXT DEFAULT '24h',
  currency_symbol_display TEXT DEFAULT 'symbol',
  currency_position TEXT DEFAULT 'before',
  items_per_page INTEGER DEFAULT 25,
  default_view TEXT DEFAULT 'table',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on all settings tables
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banking_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company_settings
CREATE POLICY "Users can view own company settings"
  ON public.company_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company settings"
  ON public.company_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for banking_details
CREATE POLICY "Users can view own banking details"
  ON public.banking_details FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own banking details"
  ON public.banking_details FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own banking details"
  ON public.banking_details FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for invoice_settings
CREATE POLICY "Users can view own invoice settings"
  ON public.invoice_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoice settings"
  ON public.invoice_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoice settings"
  ON public.invoice_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for user_preferences
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_settings_updated_at();

CREATE TRIGGER update_banking_details_updated_at
  BEFORE UPDATE ON public.banking_details
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_settings_updated_at();

CREATE TRIGGER update_invoice_settings_updated_at
  BEFORE UPDATE ON public.invoice_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_settings_updated_at();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_settings_updated_at();