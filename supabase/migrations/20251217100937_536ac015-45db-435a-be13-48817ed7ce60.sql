-- Backfill customer_id from linked invoice where invoice_id is present
UPDATE public.credit_notes 
SET customer_id = invoices.customer_id
FROM public.invoices
WHERE credit_notes.invoice_id = invoices.id
  AND credit_notes.invoice_id IS NOT NULL;

-- Set type = 'invoice_adjustment' where invoice_id is present (should already be default, but ensure consistency)
UPDATE public.credit_notes 
SET type = 'invoice_adjustment'
WHERE invoice_id IS NOT NULL;

-- Set reason to 'Credit note' where reason is empty or just whitespace
UPDATE public.credit_notes 
SET reason = 'Credit note'
WHERE reason IS NULL OR TRIM(reason) = '';