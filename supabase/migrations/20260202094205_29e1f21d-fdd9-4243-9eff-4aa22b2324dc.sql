-- Fix function search paths for security

-- handle_settings_updated_at
CREATE OR REPLACE FUNCTION public.handle_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- update_reminder_settings_updated_at
CREATE OR REPLACE FUNCTION public.update_reminder_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- lpad_int (SQL function, add search_path)
CREATE OR REPLACE FUNCTION public.lpad_int(n integer, pad integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select lpad(n::text, pad, '0')
$function$;

-- next_invoice_number
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_business_id uuid, p_prefix text DEFAULT 'INV-'::text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
  v_number text;
begin
  insert into invoice_counters (business_id, year, prefix, last_seq)
  values (p_business_id, v_year, coalesce(p_prefix, 'INV-'), 0)
  on conflict (business_id, year) do nothing;

  update invoice_counters
     set last_seq = last_seq + 1
   where business_id = p_business_id
     and year = v_year
  returning last_seq into v_seq;

  v_number := coalesce(p_prefix, 'INV-') || v_year::text || '-' || lpad_int(v_seq, 3);
  return v_number;
end
$function$;

-- next_credit_note_number
CREATE OR REPLACE FUNCTION public.next_credit_note_number(p_business_id uuid, p_prefix text DEFAULT 'CN-'::text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
  v_number text;
begin
  insert into credit_note_counters (business_id, year, prefix, last_seq)
  values (p_business_id, v_year, coalesce(p_prefix, 'CN-'), 0)
  on conflict (business_id, year) do nothing;

  update credit_note_counters
     set last_seq = last_seq + 1
   where business_id = p_business_id
     and year = v_year
  returning last_seq into v_seq;

  v_number := coalesce(p_prefix, 'CN-') || v_year::text || '-' || lpad_int(v_seq, 3);
  return v_number;
end
$function$;

-- prevent_issued_invoice_changes
CREATE OR REPLACE FUNCTION public.prevent_issued_invoice_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.is_issued = TRUE AND (
    OLD.invoice_number IS DISTINCT FROM NEW.invoice_number OR
    OLD.customer_id IS DISTINCT FROM NEW.customer_id OR
    OLD.amount IS DISTINCT FROM NEW.amount OR
    OLD.vat_rate IS DISTINCT FROM NEW.vat_rate OR
    OLD.due_date IS DISTINCT FROM NEW.due_date OR
    OLD.invoice_date IS DISTINCT FROM NEW.invoice_date OR
    OLD.discount_type IS DISTINCT FROM NEW.discount_type OR
    OLD.discount_value IS DISTINCT FROM NEW.discount_value
  ) THEN
    RAISE EXCEPTION 'Cannot modify issued invoices. Invoice issued at: %. Use credit notes for corrections.', OLD.issued_at;
  END IF;
  RETURN NEW;
END;
$function$;

-- generate_credit_note_number
CREATE OR REPLACE FUNCTION public.generate_credit_note_number(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  current_year TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN credit_note_number ~ ('^CN-' || current_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(credit_note_number FROM ('^CN-' || current_year || '-([0-9]+)$')) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM public.credit_notes
  WHERE user_id = p_user_id;
  
  RETURN 'CN-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$function$;

-- prevent_issued_invoice_deletion
CREATE OR REPLACE FUNCTION public.prevent_issued_invoice_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.is_issued = TRUE THEN
    RAISE EXCEPTION 'Cannot delete issued invoices. Use credit notes for corrections.';
  END IF;
  RETURN OLD;
END;
$function$;

-- prevent_issued_invoice_items_changes
CREATE OR REPLACE FUNCTION public.prevent_issued_invoice_items_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  invoice_issued BOOLEAN;
BEGIN
  SELECT is_issued INTO invoice_issued
  FROM public.invoices
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  IF invoice_issued = TRUE THEN
    RAISE EXCEPTION 'Cannot modify items of issued invoices. Create a credit note to correct issued invoice items.';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- log_invoice_action (add search_path)
CREATE OR REPLACE FUNCTION public.log_invoice_action(p_invoice_id uuid, p_action text, p_old_data jsonb DEFAULT NULL::jsonb, p_new_data jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.invoice_audit_log (
    invoice_id,
    user_id,
    action,
    old_data,
    new_data,
    ip_address
  ) VALUES (
    p_invoice_id,
    auth.uid(),
    p_action,
    p_old_data,
    p_new_data,
    inet_client_addr()
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to log audit action: %', SQLERRM;
END;
$function$;