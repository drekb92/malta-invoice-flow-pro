-- Fix search_path security issue for validate_credit_note_type function
CREATE OR REPLACE FUNCTION public.validate_credit_note_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- If type = 'invoice_adjustment', invoice_id must be NOT NULL
  IF NEW.type = 'invoice_adjustment' AND NEW.invoice_id IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required when type is invoice_adjustment';
  END IF;
  
  RETURN NEW;
END;
$function$;