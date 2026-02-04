
# Plan: Disable Actions on Draft Invoices

## Overview

When an invoice is still in draft status (`is_issued = false`), certain actions should be disabled because:
- **Send/Email**: You shouldn't send an incomplete, un-finalized document to customers
- **Add Payment**: Payments should only be recorded against issued invoices for proper accounting
- **Send Reminders**: Reminders are for issued invoices that are due/overdue

These actions will be enabled once the invoice is issued.

## Changes Required

### 1. Invoice Details Page (`src/pages/InvoiceDetails.tsx`)

**Current State**: The "Add Payment" button only checks `remainingBalance > 0`. Email/WhatsApp actions are available regardless of draft status.

**Changes**:
| Action | Current Condition | New Condition |
|--------|------------------|---------------|
| Add Payment | `remainingBalance > 0` | `isIssued && remainingBalance > 0` |
| Email Reminder | Always shown | Only when `isIssued` |
| WhatsApp | Always shown | Only when `isIssued` |

### 2. Invoices List Page (`src/pages/Invoices.tsx`)

**Current State**: "Add Payment" button checks `status !== "draft"` but not `is_issued`.

**Changes**:
| Action | Current Condition | New Condition |
|--------|------------------|---------------|
| Add Payment | `status !== "paid" && status !== "credited" && status !== "draft"` | Add `&& invoice.is_issued` |

### 3. Transaction Drawer Footer (`src/components/transaction-drawer/TransactionFooterActions.tsx`)

**Current State**: Actions check `remainingBalance > 0` but don't check `is_issued`.

**Changes**:
| Action | Current Condition | New Condition |
|--------|------------------|---------------|
| Add Payment | `remainingBalance > 0` | `isIssued && remainingBalance > 0` |
| Send Reminder | `remainingBalance > 0` | `isIssued && remainingBalance > 0` |
| Credit Note | `is_issued` | Already correct |

The component needs to receive `isIssued` prop from parent.

---

## Technical Details

### File: `src/pages/InvoiceDetails.tsx`

```tsx
// Line ~673-678: Add isIssued check to Add Payment button
{isIssued && remainingBalance > 0 && (
  <Button onClick={() => setShowPaymentDialog(true)} variant="secondary" size="sm">
    <Plus className="h-4 w-4 mr-1" />
    Add Payment
  </Button>
)}

// Line ~692-699: Wrap Email/WhatsApp menu items with isIssued check
{isIssued && (
  <>
    <DropdownMenuItem onClick={handleEmailReminder}>
      <Mail className="h-4 w-4 mr-2" />
      Email Reminder
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleWhatsAppReminder}>
      <MessageCircle className="h-4 w-4 mr-2" />
      WhatsApp
    </DropdownMenuItem>
  </>
)}
```

### File: `src/pages/Invoices.tsx`

```tsx
// Line ~601: Add is_issued check
{invoice.status !== "paid" && 
 invoice.status !== "credited" && 
 invoice.status !== "cancelled" && 
 (invoice as any).is_issued && (
  // Add payment button
)}
```

### File: `src/components/transaction-drawer/TransactionFooterActions.tsx`

```tsx
// Add isIssued prop to interface
interface TransactionFooterActionsProps {
  // ... existing props
  isIssued?: boolean; // New prop
}

// Update Payment button condition
{isIssued && remainingBalance > 0 && onAddPayment && (
  <Button ...>Payment</Button>
)}

// Update Remind button condition
{isIssued && remainingBalance > 0 && onSendReminder && (
  <Button ...>Remind</Button>
)}
```

### File: `src/components/TransactionDrawer.tsx`

Pass `isIssued` prop to footer:

```tsx
<TransactionFooterActions
  // ... existing props
  isIssued={type === "invoice" ? (transaction as InvoiceTransaction).is_issued : true}
/>
```

---

## User Experience

| State | Available Actions | Disabled Actions |
|-------|------------------|------------------|
| **Draft** | View, Download PDF, Edit, Delete, Issue | Add Payment, Send Email, Send Reminder, Credit Note |
| **Issued** | View, Download PDF, Add Payment, Send Email, Send Reminder, Credit Note | Edit, Delete |
| **Paid** | View, Download PDF | Add Payment, Send Reminder |

## Testing Checklist

- Verify draft invoice shows Issue button but not Add Payment
- Verify draft invoice hides Email/WhatsApp reminder options
- Verify issued invoice shows all actions appropriately
- Verify paid invoice hides Add Payment button
- Test Transaction Drawer actions mirror the detail page behavior
