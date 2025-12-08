-- 1) Backfill user_id from invoices where it's missing (safe step)
update public.payments p
set user_id = i.user_id
from public.invoices i
where p.invoice_id = i.id
  and p.user_id is null;

-- 2) Make sure invoice_id is not null (each payment must belong to an invoice)
alter table public.payments
alter column invoice_id set not null;

-- 3) Make sure user_id is not null (each payment must belong to a user)
alter table public.payments
alter column user_id set not null;

-- 4) Add foreign key from payments.invoice_id -> invoices(id) with unique name
alter table public.payments
add constraint payments_invoice_id_fkey2
    foreign key (invoice_id)
    references public.invoices(id)
    on delete cascade;

-- 5) Performance: index by (user_id, invoice_id) for fast lookups
create index if not exists idx_payments_user_invoice
  on public.payments (user_id, invoice_id);