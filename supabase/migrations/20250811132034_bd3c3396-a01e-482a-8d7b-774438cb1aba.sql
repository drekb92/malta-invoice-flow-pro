-- Security fix: Recreate invoice_totals view without auth.uid() dependency
-- This relies on base table RLS (invoices, invoice_items) to enforce access

-- Drop existing view if present
DROP VIEW IF EXISTS public.invoice_totals;

-- Create a simple aggregation view per invoice
CREATE VIEW public.invoice_totals AS
SELECT 
  i.id AS invoice_id,
  i.invoice_number,
  i.customer_id,
  i.due_date,
  i.created_at AS invoice_created_at,
  i.status,
  COALESCE(SUM(ii.quantity * ii.unit_price), 0) AS net_amount,
  COALESCE(SUM(ii.quantity * ii.unit_price * ii.vat_rate), 0) AS vat_amount,
  COALESCE(SUM(ii.quantity * ii.unit_price * (1 + ii.vat_rate)), 0) AS total_amount
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON i.id = ii.invoice_id
GROUP BY i.id, i.invoice_number, i.customer_id, i.due_date, i.created_at, i.status;