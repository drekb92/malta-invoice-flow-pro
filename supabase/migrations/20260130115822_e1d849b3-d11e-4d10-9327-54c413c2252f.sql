-- 1) Prevent edits to issued invoice headers (except allowed fields)
create or replace function public.prevent_issued_invoice_edits()
returns trigger
language plpgsql
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

drop trigger if exists trg_prevent_issued_invoice_edits on public.invoices;
create trigger trg_prevent_issued_invoice_edits
before update on public.invoices
for each row
execute function public.prevent_issued_invoice_edits();

-- 2) Prevent edits to invoice items when parent invoice is issued
create or replace function public.prevent_issued_invoice_item_edits()
returns trigger
language plpgsql
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

drop trigger if exists trg_prevent_issued_invoice_item_edits_ins on public.invoice_items;
drop trigger if exists trg_prevent_issued_invoice_item_edits_upd on public.invoice_items;
drop trigger if exists trg_prevent_issued_invoice_item_edits_del on public.invoice_items;

create trigger trg_prevent_issued_invoice_item_edits_ins
before insert on public.invoice_items
for each row
execute function public.prevent_issued_invoice_item_edits();

create trigger trg_prevent_issued_invoice_item_edits_upd
before update on public.invoice_items
for each row
execute function public.prevent_issued_invoice_item_edits();

create trigger trg_prevent_issued_invoice_item_edits_del
before delete on public.invoice_items
for each row
execute function public.prevent_issued_invoice_item_edits();