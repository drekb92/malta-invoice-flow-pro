
ALTER TABLE invoices ADD COLUMN notes text;
ALTER TABLE invoice_templates ADD COLUMN notes_visibility boolean DEFAULT true;
