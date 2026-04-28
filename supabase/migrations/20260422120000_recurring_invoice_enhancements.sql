-- Track which recurring schedule generated a draft invoice
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source_recurring_id uuid REFERENCES recurring_invoices(id) ON DELETE SET NULL;

-- Opt-in: automatically issue+send the generated invoice without creating a draft
ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS auto_issue boolean NOT NULL DEFAULT false;

-- Opt-in: email user X days before generation (NULL = disabled)
ALTER TABLE recurring_invoices
  ADD COLUMN IF NOT EXISTS notify_days_before integer DEFAULT NULL;

-- Index to efficiently find all pending recurring drafts for a user
CREATE INDEX IF NOT EXISTS idx_invoices_source_recurring_id ON invoices (source_recurring_id)
  WHERE source_recurring_id IS NOT NULL;
