
# Fix: Dashboard Lists Not Updating After Email Send

## Problem Analysis

After sending an invoice email from the Dashboard "Needs Sending" widget, the list doesn't update because:

1. **Database Trigger Blocking Updates**: The `prevent_issued_invoice_edits` trigger only allows `status` and `paid_amount` changes on issued invoices. When the edge function tries to update `last_sent_at`, `last_sent_channel`, and `last_sent_to`, the trigger raises an exception.

2. **Silent Failure in Edge Function**: The edge function catches the error but logs success anyway because the success log happens before the await resolves properly.

3. **Query Filter Logic**: The `getInvoicesNeedingSending` function filters by `status.eq.draft,and(status.neq.draft,last_sent_at.is.null)` - meaning it shows invoices where `last_sent_at` is null. Since the update fails, the invoice stays in the list.

## Solution

### Part 1: Update Database Trigger
Modify the `prevent_issued_invoice_edits` trigger to allow communication tracking fields to be updated on issued invoices.

**Allowed Fields to Add:**
- `last_sent_at`
- `last_sent_channel`
- `last_sent_to`

```sql
-- Updated trigger logic (pseudocode)
if old.is_issued = true then
    -- allow status, paid_amount, and delivery tracking columns to change
    if (new.status is distinct from old.status)
       or (coalesce(new.paid_amount,0) is distinct from coalesce(old.paid_amount,0))
       or (new.last_sent_at is distinct from old.last_sent_at)
       or (new.last_sent_channel is distinct from old.last_sent_channel)
       or (new.last_sent_to is distinct from old.last_sent_to) then
      return new;
    end if;
    -- ... rest of logic
end if;
```

### Part 2: Fix Edge Function Error Handling
Update the edge function to properly check update results and log actual success/failure.

```typescript
// Update invoice delivery tracking fields
if (documentType === 'invoice') {
  const { error: updateError, count } = await supabase
    .from('invoices')
    .update({
      last_sent_at: new Date().toISOString(),
      last_sent_channel: 'email',
      last_sent_to: to,
    })
    .eq('id', documentId);
    
  if (updateError) {
    console.warn("[send-document-email] Failed to update invoice fields:", updateError);
  } else {
    console.log("[send-document-email] Invoice delivery fields updated");
  }
}
```

### Part 3: Ensure React Query Cache Invalidation
The current implementation already calls `refetchNeedsSending()` on success - this should work once the database update succeeds.

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| Database Migration | Create | Update `prevent_issued_invoice_edits` trigger to allow delivery tracking fields |
| `supabase/functions/send-document-email/index.ts` | Modify | Add proper error handling for the invoice update |

## Technical Details

### Database Migration SQL
```sql
CREATE OR REPLACE FUNCTION public.prevent_issued_invoice_edits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.is_issued = true then
    -- allow status, paid_amount, and delivery tracking columns to change
    if (new.status is distinct from old.status)
       or (coalesce(new.paid_amount,0) is distinct from coalesce(old.paid_amount,0))
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

### Edge Function Update
Add error checking to the update operation to provide better debugging information.

## Expected Behavior After Fix

1. User clicks "Send" on an invoice in the Dashboard "Needs Sending" widget
2. Email is sent successfully
3. Edge function updates `invoices.last_sent_at`, `last_sent_channel`, `last_sent_to`
4. `onInvoiceSent()` callback triggers `refetchNeedsSending()`
5. The query refetches and the invoice no longer appears (because `last_sent_at` is no longer null)
6. List updates to show the invoice has been removed

## Testing Checklist
- Send email from Dashboard "Needs Sending" tab - invoice should disappear from list
- Send email from Invoice Details page - should still work correctly
- Verify `last_sent_at` is properly updated in the database after send
- Verify edge function logs show actual success/failure status
