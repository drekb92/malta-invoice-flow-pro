-- Prevent duplicate recurring schedules for the same source invoice.
-- The upsert now uses ON CONFLICT on this column for atomic behaviour.
ALTER TABLE recurring_invoices
  ADD CONSTRAINT recurring_invoices_source_invoice_unique UNIQUE (source_invoice_id);
