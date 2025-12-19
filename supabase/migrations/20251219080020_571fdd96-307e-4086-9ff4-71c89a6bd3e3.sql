-- Add customer_code column to customers table
ALTER TABLE public.customers ADD COLUMN customer_code text;

-- Add constraint for max 10 characters
ALTER TABLE public.customers ADD CONSTRAINT customer_code_max_length CHECK (char_length(customer_code) <= 10);

-- Add unique constraint per user
ALTER TABLE public.customers ADD CONSTRAINT customers_user_code_unique UNIQUE (user_id, customer_code);