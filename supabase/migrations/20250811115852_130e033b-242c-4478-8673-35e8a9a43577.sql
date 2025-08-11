-- Create quotations and quotation_items tables with RLS similar to invoices

-- Create quotations table
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  quotation_number text,
  amount numeric,
  vat_amount numeric,
  total_amount numeric,
  vat_rate numeric default 0.18,
  issue_date date default current_date,
  valid_until date,
  status text,
  created_at timestamp without time zone default now()
);

-- Enable RLS
alter table public.quotations enable row level security;

-- Policies mirroring invoices
create policy "Users can view own quotations"
  on public.quotations for select
  using (auth.uid() = user_id);

create policy "Users can insert own quotations"
  on public.quotations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own quotations"
  on public.quotations for update
  using (auth.uid() = user_id);

create policy "Users can delete own quotations"
  on public.quotations for delete
  using (auth.uid() = user_id);


-- Create quotation_items table
create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references public.quotations(id) on delete cascade,
  description text not null,
  quantity numeric default 1,
  unit text,
  unit_price numeric not null,
  vat_rate numeric default 0.18,
  created_at timestamp without time zone default now()
);

-- Enable RLS
alter table public.quotation_items enable row level security;

-- Policies referencing owning quotation
create policy "Users can view own quotation items"
  on public.quotation_items for select
  using (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id and q.user_id = auth.uid()
  ));

create policy "Users can insert own quotation items"
  on public.quotation_items for insert
  with check (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id and q.user_id = auth.uid()
  ));

create policy "Users can update own quotation items"
  on public.quotation_items for update
  using (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id and q.user_id = auth.uid()
  ));

create policy "Users can delete own quotation items"
  on public.quotation_items for delete
  using (exists (
    select 1 from public.quotations q
    where q.id = quotation_items.quotation_id and q.user_id = auth.uid()
  ));
