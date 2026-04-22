-- Create enum for reminder escalation levels
CREATE TYPE reminder_level AS ENUM ('friendly', 'firm', 'final');

-- Create reminder_settings table to store user preferences
CREATE TABLE public.reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_reminders_enabled BOOLEAN DEFAULT true,
  days_before_due INTEGER DEFAULT 3,
  send_on_due_date BOOLEAN DEFAULT true,
  days_after_due_first INTEGER DEFAULT 7,
  days_after_due_second INTEGER DEFAULT 14,
  days_after_due_final INTEGER DEFAULT 21,
  max_reminders INTEGER DEFAULT 5,
  stop_after_payment BOOLEAN DEFAULT true,
  reminder_frequency TEXT DEFAULT 'weekly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create reminder_templates table for email templates
CREATE TABLE public.reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level reminder_level NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create reminder_logs table to track sent reminders
CREATE TABLE public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_level reminder_level NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  email_sent BOOLEAN DEFAULT false,
  email_error TEXT,
  days_overdue INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminder_settings
CREATE POLICY "Users can view own reminder settings"
  ON public.reminder_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminder settings"
  ON public.reminder_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminder settings"
  ON public.reminder_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for reminder_templates
CREATE POLICY "Users can view own reminder templates"
  ON public.reminder_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminder templates"
  ON public.reminder_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminder templates"
  ON public.reminder_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminder templates"
  ON public.reminder_templates FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for reminder_logs
CREATE POLICY "Users can view own reminder logs"
  ON public.reminder_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminder logs"
  ON public.reminder_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_reminder_settings_user_id ON public.reminder_settings(user_id);
CREATE INDEX idx_reminder_templates_user_id ON public.reminder_templates(user_id);
CREATE INDEX idx_reminder_templates_level ON public.reminder_templates(level);
CREATE INDEX idx_reminder_logs_invoice_id ON public.reminder_logs(invoice_id);
CREATE INDEX idx_reminder_logs_customer_id ON public.reminder_logs(customer_id);
CREATE INDEX idx_reminder_logs_user_id ON public.reminder_logs(user_id);
CREATE INDEX idx_reminder_logs_sent_at ON public.reminder_logs(sent_at);

-- Insert default Malta-friendly email templates
INSERT INTO public.reminder_templates (user_id, level, subject, body, is_default)
SELECT
  u.id,
  'friendly',
  'Invoice {invoice_number} – Payment Due {due_date}',
  E'Dear {customer_name},\n\nThis is a courtesy reminder that Invoice {invoice_number} for {amount} is due on {due_date}.\n\nIf you have already arranged payment, thank you — please disregard this message.\n\nShould you have any questions, please do not hesitate to get in touch.\n\nKind regards,\n{company_name}\n{company_phone}\n{company_email}',
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.reminder_templates rt
  WHERE rt.user_id = u.id AND rt.level = 'friendly'
);

INSERT INTO public.reminder_templates (user_id, level, subject, body, is_default)
SELECT
  u.id,
  'firm',
  'Invoice {invoice_number} – Payment Overdue',
  E'Dear {customer_name},\n\nWe are writing to notify you that Invoice {invoice_number} for {amount}, due on {due_date}, is now {days_overdue} days overdue.\n\nDespite our earlier reminder, this invoice remains outstanding. We kindly ask that you arrange payment without further delay.\n\nIf you are experiencing difficulties or have a query regarding this invoice, please contact us as soon as possible so that we can assist.\n\nWe look forward to your prompt response.\n\nKind regards,\n{company_name}\n{company_phone}\n{company_email}',
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.reminder_templates rt
  WHERE rt.user_id = u.id AND rt.level = 'firm'
);

INSERT INTO public.reminder_templates (user_id, level, subject, body, is_default)
SELECT
  u.id,
  'final',
  'Final Notice: Invoice {invoice_number} – Immediate Payment Required',
  E'Dear {customer_name},\n\nThis is a formal final notice regarding Invoice {invoice_number} for {amount}, which was due on {due_date} and remains unpaid after {days_overdue} days.\n\nNotwithstanding our previous correspondence, full payment has not been received. You are hereby required to settle this balance within 5 business days of this notice.\n\nFailure to do so may result in the following:\n\n\u2022 Statutory late payment interest at 8 percentage points above the European Central Bank reference rate, in accordance with EU Directive 2011/7/EU as transposed into Maltese law\n\u2022 Referral to a debt collection agency\n\u2022 Legal proceedings to recover the outstanding amount, court costs, and any associated expenses\n\nIf payment has already been made, please send confirmation to {company_email} immediately.\n\nThis letter constitutes formal notice of the outstanding debt and may be presented as evidence of demand in any subsequent legal proceedings.\n\nYours faithfully,\n{company_name}\n{company_phone}\n{company_email}',
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.reminder_templates rt
  WHERE rt.user_id = u.id AND rt.level = 'final'
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reminder_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reminder_settings_updated_at
  BEFORE UPDATE ON public.reminder_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_settings_updated_at();

CREATE TRIGGER reminder_templates_updated_at
  BEFORE UPDATE ON public.reminder_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_settings_updated_at();