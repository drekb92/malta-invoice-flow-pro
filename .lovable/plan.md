

## Show Full Next Invoice Number Preview

### Problem
The badge currently shows only `Next: INV-2026` — it doesn't include the sequence number (e.g., `INV-2026-001`).

### Approach
Query the `invoice_counters` table on mount (read-only, no increment) to get `last_seq`, then display `prefix + year + '-' + padded(last_seq + 1)` as the preview. This avoids consuming a number.

### Changes

**`src/pages/NewInvoice.tsx`**
1. Add a `useEffect` that runs when the component mounts (for new invoices only, not edit mode). It queries `invoice_counters` for the current user's `last_seq` and year, then computes the preview string: `{prefix}{year}-{padded(last_seq + 1)}`. If no counter row exists yet, default to `001`.
2. Store this in a `nextNumberPreview` state variable.
3. Replace the badge content from the static `{prefix}{year}` to the full `{nextNumberPreview}`.

This is a read-only SELECT on `invoice_counters` — it does not increment the counter or call the RPC.

### Files
- `src/pages/NewInvoice.tsx` — add state + effect for preview, update badge display

