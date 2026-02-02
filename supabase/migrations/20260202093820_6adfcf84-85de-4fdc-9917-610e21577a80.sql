CREATE OR REPLACE FUNCTION public.prevent_issued_invoice_edits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.is_issued = true then
    -- allow status, paid_amount, and delivery tracking columns to change
    if (new.status is distinct from old.status)
       or (coalesce(new.paid_amount,0) is distinct from coalesce(old.paid_amount,0))
       or (new.last_sent_at is distinct from old.last_sent_at)
       or (new.last_sent_channel is distinct from old.last_sent_channel)
       or (new.last_sent_to is distinct from old.last_sent_to) then
      return new;
    end if;
    -- if anything else changed, block
    if row(new.*) is distinct from row(old.*) then
      raise exception 'Issued invoices are immutable. Use a credit note to correct.';
    end if;
  end if;
  return new;
end;
$function$;