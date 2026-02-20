

# Fix "Convert & Send" — Items Blocked by Immutability Trigger

## Root Cause

The `handleConvertAndSend` function creates the invoice with `is_issued: true` **before** inserting the line items. The database trigger `prevent_issued_invoice_items_changes` then blocks the item insert because the invoice is already marked as issued.

The sequence today:
1. INSERT invoice with `is_issued: true` (line 630) -- succeeds
2. INSERT invoice_items (line 658) -- **BLOCKED by trigger**
3. Error thrown, quotation never marked as "converted"

This leaves the system in a broken state: an invoice exists (with no items), and the quotation remains unconverted.

## Fix

Reorder the operations so items are inserted **before** the invoice is marked as issued:

1. INSERT invoice with `status: "draft"`, `is_issued: false` (no trigger conflict)
2. INSERT invoice_items (allowed because invoice is not yet issued)
3. Generate the invoice hash (needs items to exist for accurate hash)
4. UPDATE invoice to `status: "sent"`, `is_issued: true`, `issued_at: now()`, `invoice_hash: ...` (the immutability trigger allows this because `is_issued` was previously `false`)
5. Render PDF, send email, mark quotation as converted, redirect

## Code Changes

### `src/pages/Quotations.tsx` — `handleConvertAndSend` function

**Step 1**: Change the initial invoice insert to create a draft:
```tsx
const invoicePayload = {
  ...existingFields,
  status: "draft",       // was "sent"
  is_issued: false,      // was true
  issued_at: null,       // was new Date().toISOString()
  // invoice_hash omitted — set later
};
```

**Step 2**: Move the invoice items insert immediately after the invoice creation (no change needed, already in this position).

**Step 3**: Generate the hash after items exist (already in this position, but move it after items insert).

**Step 4**: Add a single UPDATE to finalize the invoice after items and hash are ready:
```tsx
await supabase.from("invoices").update({
  status: "sent",
  is_issued: true,
  issued_at: new Date().toISOString(),
  invoice_hash: invoiceHash,
}).eq("id", inv.id);
```

**Step 5**: Continue with PDF rendering, email sending, quotation status update, and redirect (unchanged).

This matches the safe ordering: create draft, add items, then issue — avoiding the trigger entirely.
