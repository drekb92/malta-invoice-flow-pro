

## Problem

The recurring schedule card is only visible when editing a saved invoice (`isEditMode && id`), meaning:
1. Users creating a brand new invoice never see the recurring option
2. Users who issue immediately and never return to edit mode can't set it up
3. On InvoiceDetails, the card uses `viewOnly={true}` which hides it entirely if no schedule exists yet — so there's no way to add one from that page either

## Solution

Make the recurring schedule accessible from **InvoiceDetails** (the page users land on after saving/issuing) as a full management card, not just a read-only view. Also show it during new invoice creation with a deferred-save pattern.

### Changes

**1. InvoiceDetails: Change `viewOnly` to `false`**
In `src/pages/InvoiceDetails.tsx` (line ~1019), change `viewOnly={true}` to `viewOnly={false}`. This makes the recurring toggle visible on InvoiceDetails even when no schedule exists yet, allowing users to set up recurring from the detail page of any invoice (including issued ones). This is the primary fix.

**2. NewInvoice: Show recurring card before save with deferred state**
In `src/pages/NewInvoice.tsx`, remove the `isEditMode && id` guard and show the `RecurringScheduleCard` area even for new invoices. Two approaches:
- **Simple approach**: Show a hint message like "Save this invoice first to enable recurring" when creating new (no `id` yet), so users know the option exists.
- Keep the full card with toggle visible once the invoice is saved (current behavior on edit).

**3. RecurringScheduleCard: Add "not yet saved" placeholder state**
In `src/components/RecurringScheduleCard.tsx`, when `invoiceId` is not provided (new unsaved invoice), render a collapsed informational state: the card title "Recurring" with a note "Save invoice to enable recurring schedule" instead of hiding completely.

### Summary of file changes
- `src/pages/InvoiceDetails.tsx` — set `viewOnly={false}` on RecurringScheduleCard
- `src/pages/NewInvoice.tsx` — remove `isEditMode && id` guard, show card always
- `src/components/RecurringScheduleCard.tsx` — add placeholder state for when no `invoiceId` exists

