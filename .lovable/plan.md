

## Recurring Invoice Schedules — Implementation Plan

### Overview
Add the ability for users to set up recurring invoice schedules (weekly, monthly, quarterly, annually) that automatically generate draft invoices on a cron schedule. This is critical for Malta-based consultants and service businesses with retainer/subscription models.

### 1. Database: New `recurring_invoices` table

```sql
CREATE TABLE public.recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_invoice_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annually')),
  next_run_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_generated_at timestamptz,
  total_generated integer NOT NULL DEFAULT 0
);

ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies (user-scoped)
CREATE POLICY "Users can view own recurring invoices" ON public.recurring_invoices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring invoices" ON public.recurring_invoices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring invoices" ON public.recurring_invoices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring invoices" ON public.recurring_invoices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER handle_recurring_invoices_updated_at
  BEFORE UPDATE ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 2. Edge Function: `process-recurring-invoices`

A new Deno edge function at `supabase/functions/process-recurring-invoices/index.ts`:

- Uses service role key to bypass RLS
- Queries `recurring_invoices` where `is_active = true` and `next_run_date <= today`
- For each due schedule:
  - Fetches the source invoice + its items
  - Creates a new draft invoice (copying customer, items, VAT rates, discount settings)
  - Generates a new invoice number via `next_invoice_number` RPC (or leaves null for draft)
  - Sets `invoice_date = today`, calculates `due_date` from customer payment terms
  - Inserts invoice items copied from the source
  - Advances `next_run_date` based on frequency
  - Increments `total_generated`, sets `last_generated_at`
- Registered in `config.toml` with `verify_jwt = false`
- Designed to be triggered by pg_cron (daily)

### 3. Frontend: "Make Recurring" on NewInvoice page

After an invoice is saved (in the submit handler of `src/pages/NewInvoice.tsx`), add a section in the right sidebar:

- A "Make Recurring" `Switch` toggle (only shown when editing an existing invoice or after first save)
- When toggled on, show a `Select` dropdown: Weekly / Monthly / Quarterly / Annually
- A "Start Date" date picker for `next_run_date` (defaults to next occurrence based on frequency)
- On save, upsert into `recurring_invoices` table

### 4. Frontend: Recurring schedule management on InvoiceDetails page

In `src/pages/InvoiceDetails.tsx`, add a collapsible section:

- If the invoice has an active recurring schedule, show: frequency, next run date, total generated count
- Buttons to: Pause (set `is_active = false`), Resume, Cancel (delete the schedule)
- Badge indicator showing "Recurring: Monthly" etc.

### 5. Dashboard: Active Recurring Schedules widget

In `src/pages/Index.tsx`, add a small card/widget showing:

- Count of active recurring schedules
- Next upcoming generation date
- Link to a filtered view

New hook `useRecurringInvoices` in `src/hooks/useRecurringInvoices.ts` to fetch active schedules.
New dashboard query function in `src/lib/dashboard.ts`.

### 6. Invoices list page indicator

In `src/pages/Invoices.tsx`, add a small recurring icon/badge next to invoices that are source invoices for active recurring schedules.

### Files to create
- `supabase/functions/process-recurring-invoices/index.ts`
- `src/hooks/useRecurringInvoices.ts`

### Files to modify
- Database migration (new table)
- `supabase/config.toml` — register new edge function
- `src/pages/NewInvoice.tsx` — add recurring toggle in sidebar
- `src/pages/InvoiceDetails.tsx` — show/manage recurring schedule
- `src/pages/Index.tsx` — dashboard widget
- `src/lib/dashboard.ts` — new query for recurring data
- `src/hooks/useDashboard.ts` — new hook export

### Cron setup
After implementation, a `pg_cron` job will need to be created (via SQL insert, not migration) to call the edge function daily.

