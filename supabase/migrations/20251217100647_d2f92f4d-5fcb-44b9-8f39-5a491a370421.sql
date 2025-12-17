-- Add type column with allowed values
ALTER TABLE public.credit_notes 
ADD COLUMN type text NOT NULL DEFAULT 'invoice_adjustment';

-- Add check constraint for type values
ALTER TABLE public.credit_notes 
ADD CONSTRAINT credit_notes_type_check 
CHECK (type IN ('invoice_adjustment', 'customer_credit'));

-- Add issued_at timestamp column
ALTER TABLE public.credit_notes 
ADD COLUMN issued_at timestamp with time zone;

-- Rename original_invoice_id to invoice_id for consistency
ALTER TABLE public.credit_notes 
RENAME COLUMN original_invoice_id TO invoice_id;

-- Update customer_id to NOT NULL (first update any NULL values if they exist)
UPDATE public.credit_notes 
SET customer_id = (
  SELECT customer_id FROM public.invoices WHERE id = credit_notes.invoice_id
)
WHERE customer_id IS NULL AND invoice_id IS NOT NULL;

-- Make customer_id NOT NULL
ALTER TABLE public.credit_notes 
ALTER COLUMN customer_id SET NOT NULL;

-- Create validation trigger for type/invoice_id rules
CREATE OR REPLACE FUNCTION public.validate_credit_note_type()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- If type = 'invoice_adjustment', invoice_id must be NOT NULL
  IF NEW.type = 'invoice_adjustment' AND NEW.invoice_id IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required when type is invoice_adjustment';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger
CREATE TRIGGER validate_credit_note_type_trigger
BEFORE INSERT OR UPDATE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.validate_credit_note_type();

-- Set issued_at for existing issued credit notes
UPDATE public.credit_notes 
SET issued_at = created_at 
WHERE status = 'issued' AND issued_at IS NULL;