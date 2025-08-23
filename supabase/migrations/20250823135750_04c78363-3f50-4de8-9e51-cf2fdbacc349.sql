-- Drop the existing insecure view
DROP VIEW IF EXISTS public.invoice_totals;

-- Recreate the view with proper user filtering (without SECURITY DEFINER)
CREATE VIEW public.invoice_totals AS
SELECT 
  i.id AS invoice_id,
  i.invoice_number,
  i.customer_id,
  i.due_date,
  i.created_at AS invoice_created_at,
  i.status,
  COALESCE(sum((ii.quantity * ii.unit_price)), (0)::numeric) AS net_amount,
  COALESCE(sum(((ii.quantity * ii.unit_price) * ii.vat_rate)), (0)::numeric) AS vat_amount,
  COALESCE(sum(((ii.quantity * ii.unit_price) * ((1)::numeric + ii.vat_rate))), (0)::numeric) AS total_amount
FROM invoices i
LEFT JOIN invoice_items ii ON (i.id = ii.invoice_id)
WHERE i.user_id = auth.uid()  -- Critical: Only show user's own invoices
GROUP BY i.id, i.invoice_number, i.customer_id, i.due_date, i.created_at, i.status;