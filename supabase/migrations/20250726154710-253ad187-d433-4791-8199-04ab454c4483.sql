-- Fix security linter warnings - properly handle function dependencies
-- Drop trigger first, then function, then recreate both
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Recreate functions with proper search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Fix the security definer view issue by recreating invoice_totals as a regular view
DROP VIEW IF EXISTS public.invoice_totals;
CREATE VIEW public.invoice_totals AS
SELECT 
  i.id as invoice_id,
  i.invoice_number,
  i.customer_id,
  i.due_date,
  i.created_at as invoice_created_at,
  i.status,
  COALESCE(SUM(ii.quantity * ii.unit_price), 0) as net_amount,
  COALESCE(SUM(ii.quantity * ii.unit_price * ii.vat_rate), 0) as vat_amount,
  COALESCE(SUM(ii.quantity * ii.unit_price * (1 + ii.vat_rate)), 0) as total_amount
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON i.id = ii.invoice_id
WHERE i.user_id = auth.uid()  -- Ensure RLS compliance
GROUP BY i.id, i.invoice_number, i.customer_id, i.due_date, i.created_at, i.status;