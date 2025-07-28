-- Add missing columns to invoices table for VAT and total amounts
ALTER TABLE public.invoices 
ADD COLUMN vat_amount numeric,
ADD COLUMN total_amount numeric;