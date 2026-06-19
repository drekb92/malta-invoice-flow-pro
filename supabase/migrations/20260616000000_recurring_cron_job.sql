-- Schedule daily processing of recurring invoices at 06:00 UTC.
-- pg_cron and pg_net extensions are already enabled (migration 20260104173134).
-- The function has verify_jwt = false, so the anon key in the apikey header is sufficient.
-- Replace <SUPABASE_ANON_KEY> with the project anon key from the Supabase Dashboard → Settings → API.

SELECT cron.schedule(
  'process-recurring-invoices-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://cmysusctooyobrlnwtgt.supabase.co/functions/v1/process-recurring-invoices',
    headers := '{"Content-Type": "application/json", "apikey": "<SUPABASE_ANON_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
