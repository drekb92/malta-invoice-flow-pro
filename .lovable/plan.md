
# Fix: Remove Invalid `paid_amount` Reference from Trigger

## Problem Identified

The database trigger `prevent_issued_invoice_edits` references a column `paid_amount` that **does not exist** in the invoices table. When the edge function tries to update delivery tracking fields (`last_sent_at`, `last_sent_channel`, `last_sent_to`), the trigger throws an error:

```
record "new" has no field "paid_amount"
```

This prevents the invoice from being updated, so it remains in the "Needs Sending" list.

## Evidence

| Check | Result |
|-------|--------|
| Invoice INV-2025-020 `last_sent_at` | `null` (update failed) |
| Invoice INV-2025-020 `is_issued` | `true` |
| Invoices table columns | No `paid_amount` column exists |
| Edge function logs | `Failed to update invoice delivery fields: record "new" has no field "paid_amount"` |

## Solution

Update the `prevent_issued_invoice_edits` trigger to remove the invalid `paid_amount` reference. The trigger should only check for fields that actually exist.

## Database Migration

```sql
CREATE OR REPLACE FUNCTION public.prevent_issued_invoice_edits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.is_issued = true then
    -- allow status and delivery tracking columns to change
    if (new.status is distinct from old.status)
       or (new.last_sent_at is distinct from old.last_sent_at)
       or (new.last_sent_channel is distinct from old.last_sent_channel)
       or (new.last_sent_to is distinct from old.last_sent_to) then
      return new;
    end if;
    -- if anything else changed, block
    if row(new.*) is distinct from row(old.*) then
      raise exception 'Issued invoices are immutable. Use a credit note to correct.';
    end if;
  end if;
  return new;
end;
$function$;
```

**Key Change**: Removed line 11 which referenced `new.paid_amount` / `old.paid_amount`.

## Files to Modify

| File | Action |
|------|--------|
| Database Migration | Create new migration to fix trigger |

## Expected Result After Fix

1. Email is sent from Dashboard
2. Edge function updates `last_sent_at`, `last_sent_channel`, `last_sent_to` successfully
3. Invoice disappears from "Needs Sending" list
4. INV-2025-020 should update correctly on next send attempt

## Testing Checklist

- Verify trigger no longer references `paid_amount`
- Send email for INV-2025-020 again
- Confirm invoice disappears from "Needs Sending" list
- Verify `last_sent_at` is populated in database
