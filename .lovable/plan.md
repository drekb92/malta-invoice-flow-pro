

## Diagnose Template Save Failure

### Analysis

I reviewed the `handleSave` function in `InvoiceTemplates.tsx` (lines 307-354). The update writes 12 fields to the `invoice_templates` table — all columns exist in the DB schema and the Supabase types. The code looks correct on paper.

The problem is the catch block at line 349 swallows the error silently:
```ts
catch {
  toast({ title: "Save failed", ... });
}
```
No `console.error`, so the actual Supabase error message is invisible.

I also found a related bug: the **"Show VAT Summary" toggle** (`vat_summary_visibility`) is in the UI and updates local state, but:
- The column does **not exist** in the `invoice_templates` DB table
- The `handleSave` function does **not** include it in the update
- So this toggle resets on page reload — it never persists

### Plan

**1. Add error logging to catch block** (`src/pages/InvoiceTemplates.tsx` line 349)
- Change `catch {` to `catch (err) { console.error("Template save error:", err);`
- This will surface the actual Supabase error in the console for diagnosis

**2. Add `vat_summary_visibility` column to DB** (migration)
- `ALTER TABLE invoice_templates ADD COLUMN vat_summary_visibility boolean DEFAULT false;`
- This allows the VAT Summary toggle to actually persist

**3. Add `vat_summary_visibility` to the save function** (line 325)
- Include `vat_summary_visibility: currentSettings.vat_summary_visibility` in the update object

### Files to modify
- `src/pages/InvoiceTemplates.tsx` — add error logging, add `vat_summary_visibility` to save
- Migration for `vat_summary_visibility` column

