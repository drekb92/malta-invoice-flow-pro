

# Fix: Quotation Conversion Creates Non-Editable Invoice

## Problem

When converting a quotation to an invoice:
1. The invoice is created with `status: "pending"` and `is_issued: false`
2. The `canEditInvoice` function checks `if (status !== 'draft')` to block editing
3. Since `"pending" !== "draft"`, the system incorrectly treats the invoice as immutable
4. Error displayed: "Invoice -2026-002 has been issued and cannot be edited"

**Database evidence:**
```
invoice_number: INV-2026-002
status: pending      <-- Should be 'draft'
is_issued: false     <-- Correctly false
```

## Root Cause

There's a mismatch between:
- **Quotation conversion** (`Quotations.tsx` line 435): Sets `status: "pending"`
- **Edit check** (`invoiceService.ts` line 138): Only allows editing when `status === 'draft'`

## Solution

Two changes are needed:

### 1. Fix Quotation Conversion to Use Correct Status

**File: `src/pages/Quotations.tsx`** (line 435)

Change:
```typescript
status: "pending",
```
To:
```typescript
status: "draft",
```

This ensures converted quotations start as editable drafts that can be modified before issuing.

### 2. Fix Existing Data in Database

The invoice `d10e8737-3abc-4a38-916c-77d6ab3f3122` currently has `status: 'pending'` and needs to be corrected to `status: 'draft'`.

**Database migration:**
```sql
UPDATE invoices 
SET status = 'draft' 
WHERE id = 'd10e8737-3abc-4a38-916c-77d6ab3f3122' 
  AND is_issued = false;
```

## Why Not Change the `canEditInvoice` Logic?

The current check (`status !== 'draft'`) is correct per the invoice status model architecture:
- **Draft**: Editable, not yet finalized
- **Issued/Sent/Paid/Overdue**: Immutable, locked for VAT compliance

Adding `pending` as another editable status would create inconsistency. The root problem is using `pending` at all for converted quotations.

## Expected Behavior After Fix

| Action | Before Fix | After Fix |
|--------|-----------|-----------|
| Convert quotation | Creates with `status: pending` | Creates with `status: draft` |
| Edit converted invoice | Error: "Cannot be edited" | Works normally |
| Save & Issue | Error: "Cannot be edited" | Issues successfully |

## Files to Modify

| File | Type | Change |
|------|------|--------|
| `src/pages/Quotations.tsx` | Modify | Line 435: `status: "pending"` -> `status: "draft"` |
| Database migration | Create | Fix the specific invoice status to `draft` |

## Testing Verification

After implementation:
1. The invoice INV-2026-002 should be editable
2. Adding items should work
3. "Save & Issue" should successfully issue the invoice
4. Future quotation conversions will create proper draft invoices

