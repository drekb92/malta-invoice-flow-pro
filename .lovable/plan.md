## Invoice Prefix & Numbering Settings Fix

### Problem

The `invoice_settings` table has a `numbering_prefix` column, and the Settings page lets users edit it, but every callsite that generates invoice numbers hardcodes `'INV-'` instead of reading the saved prefix. There's also no live preview of the next number, and no "reset annually" toggle (though the RPC already partitions by year naturally).

### Key Insight

The `next_invoice_number` RPC already partitions counters by `(business_id, year)` — so annual reset **already works**. The counter resets each January because a new year creates a new row. The only real issues are:

1. Hardcoded `'INV-'` prefix in 5 callsites
2. No live preview of next invoice number
3. No explicit "reset annually" toggle in Settings (even though it's the default behavior)

### Changes

**1. Read prefix from settings everywhere (5 files)**

Replace all hardcoded `'INV-'` with the user's saved prefix from `invoice_settings`:

- `**src/pages/NewInvoice.tsx**` (3 locations, lines ~170, ~478, ~586) — already has `invoiceSettings` from `useInvoiceSettings()`. Use `invoiceSettings?.numbering_prefix || 'INV-'` instead of `'INV-'`.
- `**src/services/invoiceService.ts**` (line ~59) — the `issueInvoice` method needs to fetch the prefix from `invoice_settings` before calling the RPC. Add a query to get the user's prefix.
- `**src/pages/Quotations.tsx**` (line ~427) — this converts a quotation to an invoice. Import `useInvoiceSettings` and use the saved prefix.
- `**src/pages/Onboarding.tsx**` (line ~280) — uses `'INV-'` during onboarding. This is fine as a default since no settings exist yet, but can read from settings if available.

**2. Add live preview to Settings Invoice tab**

In `src/pages/Settings.tsx`, below the prefix input field (~line 1385), add a preview showing what the next invoice number will look like: e.g. `"Next: INV-2026-042"`. This reads the current year and `nextNumber` from state.

**3. Add live preview to NewInvoice page header**

In `src/pages/NewInvoice.tsx`, when creating a new invoice (not edit mode), show a small badge/text in the header area like `"Next number: INV-2026-042"` so users know what number will be assigned on issuance. This is a read-only preview — the actual number is still generated at issuance time.

**4. Add "Reset numbering annually" info in Settings**

Since the RPC already resets per year, add an informational toggle/indicator in the Settings Invoice Numbering card. This is already the default behavior — the toggle would be cosmetic/informational showing "Numbering resets each January". No database changes needed since the `invoice_counters` table already partitions by year.

### Files to modify

- `src/pages/NewInvoice.tsx` — replace 3 hardcoded prefixes, add next-number preview
- `src/services/invoiceService.ts` — fetch prefix from DB before RPC call
- `src/pages/Quotations.tsx` — replace hardcoded prefix
- `src/pages/Onboarding.tsx` — replace hardcoded prefix (minor)
- `src/pages/Settings.tsx` — add live preview and annual reset info

### No database changes needed

The `invoice_settings.numbering_prefix` column and `invoice_counters` year-based partitioning already exist.