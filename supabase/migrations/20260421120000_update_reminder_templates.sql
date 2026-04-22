-- Update reminder email templates with improved copy:
-- • Friendly: remove filler, add contact details, due date in subject
-- • Firm: acknowledge previous reminder, firmer language, add contact details
-- • Final: specific EU legal citation (Directive 2011/7/EU, 8pt above ECB rate),
--          formal demand language, "Yours faithfully" close

UPDATE public.reminder_templates
SET
  subject = 'Invoice {invoice_number} – Payment Due {due_date}',
  body    = E'Dear {customer_name},\n\nThis is a courtesy reminder that Invoice {invoice_number} for {amount} is due on {due_date}.\n\nIf you have already arranged payment, thank you — please disregard this message.\n\nShould you have any questions, please do not hesitate to get in touch.\n\nKind regards,\n{company_name}\n{company_phone}\n{company_email}',
  updated_at = now()
WHERE level = 'friendly'
  AND is_default = true;

UPDATE public.reminder_templates
SET
  subject = 'Invoice {invoice_number} – Payment Overdue',
  body    = E'Dear {customer_name},\n\nWe are writing to notify you that Invoice {invoice_number} for {amount}, due on {due_date}, is now {days_overdue} days overdue.\n\nDespite our earlier reminder, this invoice remains outstanding. We kindly ask that you arrange payment without further delay.\n\nIf you are experiencing difficulties or have a query regarding this invoice, please contact us as soon as possible so that we can assist.\n\nWe look forward to your prompt response.\n\nKind regards,\n{company_name}\n{company_phone}\n{company_email}',
  updated_at = now()
WHERE level = 'firm'
  AND is_default = true;

UPDATE public.reminder_templates
SET
  subject = 'Final Notice: Invoice {invoice_number} – Immediate Payment Required',
  body    = E'Dear {customer_name},\n\nThis is a formal final notice regarding Invoice {invoice_number} for {amount}, which was due on {due_date} and remains unpaid after {days_overdue} days.\n\nNotwithstanding our previous correspondence, full payment has not been received. You are hereby required to settle this balance within 5 business days of this notice.\n\nFailure to do so may result in the following:\n\n\u2022 Statutory late payment interest at 8 percentage points above the European Central Bank reference rate, in accordance with EU Directive 2011/7/EU as transposed into Maltese law\n\u2022 Referral to a debt collection agency\n\u2022 Legal proceedings to recover the outstanding amount, court costs, and any associated expenses\n\nIf payment has already been made, please send confirmation to {company_email} immediately.\n\nThis letter constitutes formal notice of the outstanding debt and may be presented as evidence of demand in any subsequent legal proceedings.\n\nYours faithfully,\n{company_name}\n{company_phone}\n{company_email}',
  updated_at = now()
WHERE level = 'final'
  AND is_default = true;
