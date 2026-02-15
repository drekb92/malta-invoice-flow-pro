
# Fix Invoice Status Mismatch Between List and Panel

## Problem
The invoice list page computes a display status based on `is_issued`, payments, and due date (showing "Overdue", "Partially Paid", etc.), while the right-side settlement panel (`InvoiceSettlementSheet.tsx`) just reads the raw database `status` field. This causes mismatched badges.

## Solution
Update `InvoiceSettlementSheet.tsx` to compute the display status using the same logic as the list page, taking into account:
- Whether the invoice is issued (`is_issued`)
- Payment totals (paid, partially paid)
- Due date vs today (overdue)

## Changes

### `src/components/InvoiceSettlementSheet.tsx`

1. **After loading settlement data** (payments, credit notes), compute the effective status instead of using the raw `invoice.status`.

2. **Replace line 395** (`const statusBadge = getStatusBadge(invoice.status)`) with computed status logic:
   - If `invoice.status === "void"` -- show "Void" (not currently in the badge map, but should be handled)
   - If balance is 0 and there are payments -- show "Paid"
   - If `totalPayments > 0` but balance > 0 -- show "Partially Paid"  
   - If `invoice.is_issued` and due date is past today -- show "Overdue"
   - If `invoice.is_issued` -- show "Issued"
   - Otherwise -- show "Draft"

3. **Add missing statuses to the local `getStatusBadge` function** (line 81-114): add `void` entry for completeness.

This reuses the data already loaded by the component (payments, credit notes, remaining balance) so no extra queries are needed.

## Technical Detail

```
// Compute effective status from settlement data (replaces line 395)
const computedStatus = useMemo(() => {
  if (invoice.status === "void") return "void";
  if (invoice.status === "credited") return "credited"; // preserve if used
  if (remainingBalance <= 0 && payments.length > 0) return "paid";
  if (totalPayments > 0 && remainingBalance > 0) return "partially_paid";
  if (invoice.is_issued) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(invoice.due_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) return "overdue";
    return "issued";
  }
  return "draft";
}, [invoice, remainingBalance, totalPayments, payments.length]);

const statusBadge = getStatusBadge(computedStatus);
```

This ensures the panel badge matches the list badge exactly.
