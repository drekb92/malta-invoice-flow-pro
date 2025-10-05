-- Add bank details columns to invoice_templates
ALTER TABLE invoice_templates
ADD COLUMN bank_name TEXT,
ADD COLUMN bank_account_name TEXT,
ADD COLUMN bank_iban TEXT,
ADD COLUMN bank_swift TEXT;

-- Insert the new "Clean Minimal" template
INSERT INTO invoice_templates (
  name,
  is_default,
  primary_color,
  accent_color,
  font_family,
  font_size,
  bank_name,
  bank_account_name,
  bank_iban,
  bank_swift
) VALUES (
  'Clean Minimal',
  false,
  '#111827',
  '#111827',
  'Inter',
  '13px',
  'Your Bank',
  'Your Company Ltd',
  'MT00VALL220123456789000000000',
  'VALLMTMT'
);