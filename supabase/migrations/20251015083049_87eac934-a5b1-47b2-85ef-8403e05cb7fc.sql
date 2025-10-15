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
  'Friendly Reminder: Invoice {invoice_number} Payment Due',
  E'Dear {customer_name},\n\nWe hope this message finds you well.\n\nThis is a friendly reminder that Invoice {invoice_number} for {amount} is due on {due_date}.\n\nIf you have already processed this payment, please disregard this message. Otherwise, we would appreciate your prompt attention to this matter.\n\nShould you have any questions or require additional information, please do not hesitate to contact us.\n\nThank you for your continued business.\n\nBest regards,\n{company_name}',
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
  'Payment Reminder: Invoice {invoice_number} Now Overdue',
  E'Dear {customer_name},\n\nWe are writing to remind you that Invoice {invoice_number} for {amount}, which was due on {due_date}, remains unpaid.\n\nAs per our payment terms, we kindly request that you settle this outstanding amount at your earliest convenience. Payment is now {days_overdue} days overdue.\n\nIf there are any issues or concerns regarding this invoice, please contact us immediately so we can address them together.\n\nWe value our business relationship and look forward to your prompt response.\n\nKind regards,\n{company_name}\nPayment Terms: {payment_terms}',
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
  'FINAL NOTICE: Immediate Payment Required - Invoice {invoice_number}',
  E'Dear {customer_name},\n\nThis is our FINAL NOTICE regarding Invoice {invoice_number} for {amount}, originally due on {due_date}.\n\nDespite our previous reminders, this invoice remains unpaid for {days_overdue} days. We must now insist on immediate payment to avoid further action.\n\nPlease arrange payment within 5 business days of receiving this notice. Failure to do so may result in:\n- Late payment interest charges as per Maltese law\n- Suspension of services\n- Referral to debt collection\n- Legal action to recover the outstanding amount\n\nIf you have already made payment, please provide proof of payment immediately. Otherwise, we urge you to contact us without delay to discuss payment arrangements.\n\nThis matter requires your immediate attention.\n\nRegards,\n{company_name}\nPhone: {company_phone}\nEmail: {company_email}',
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