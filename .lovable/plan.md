

## Diagnosis: Recurring Invoice Not Firing

### Root Cause
The `pg_cron` job runs daily at 6:00 AM and calls the `process-recurring-invoices` edge function — but the function **does not exist on your Supabase project**. The HTTP response from today at 06:00 UTC shows:

```text
Status: 404
Body: {"code":"NOT_FOUND","message":"Requested function was not found"}
```

The function code is in the repo but was never deployed. Lovable auto-deploys edge functions when they are modified, so a trivial edit will trigger deployment.

### Evidence
- `recurring_invoices` table has your schedule: INV-2026-014, weekly, `next_run_date = 2026-03-19`, `total_generated = 0`, `last_generated_at = null`
- `cron.job` table shows the cron is active and running at `0 6 * * *`
- `net._http_response` confirms the function returned 404 today at 06:00 UTC

### Fix

**1. Trigger deployment of `process-recurring-invoices`**
- Make a trivial change to `supabase/functions/process-recurring-invoices/index.ts` (e.g., update a log message) so Lovable deploys it

**2. Manually invoke the function once** to process the overdue schedule (next_run_date = 2026-03-19, which is yesterday)
- Use `supabase--curl_edge_functions` to call it, which will:
  - Clone INV-2026-014 into a new draft invoice
  - Advance `next_run_date` to 2026-03-26
  - Set `last_generated_at` and increment `total_generated`

### Files to modify
- `supabase/functions/process-recurring-invoices/index.ts` — trivial change to trigger deploy

