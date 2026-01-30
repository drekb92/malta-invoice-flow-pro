-- Fix search_path on newly created trigger functions for security compliance
create or replace function public.prevent_issued_invoice_edits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_issued = true then
    -- allow only these columns to change
    if (new.status is distinct from old.status)
       or (coalesce(new.paid_amount,0) is distinct from coalesce(old.paid_amount,0)) then
      return new;
    end if;
    -- if anything else changed, block
    if row(new.*) is distinct from row(old.*) then
      raise exception 'Issued invoices are immutable. Use a credit note to correct.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_issued_invoice_item_edits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issued boolean;
begin
  select is_issued into v_issued
  from public.invoices
  where id = coalesce(new.invoice_id, old.invoice_id);

  if v_issued = true then
    raise exception 'Cannot modify items of an issued invoice. Create a credit note.';
  end if;

  return coalesce(new, old);
end;
$$;