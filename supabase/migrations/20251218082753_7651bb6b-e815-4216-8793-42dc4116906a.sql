-- Add structured address fields to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS locality text,
ADD COLUMN IF NOT EXISTS post_code text;

-- Add structured address fields to company_settings table
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS company_address_line1 text,
ADD COLUMN IF NOT EXISTS company_address_line2 text,
ADD COLUMN IF NOT EXISTS company_locality text,
ADD COLUMN IF NOT EXISTS company_post_code text;