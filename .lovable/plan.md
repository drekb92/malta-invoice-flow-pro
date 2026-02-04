
# Plan: Disable Actions for Fully Paid Invoices + Payment Confirmation Email

## Overview

This plan addresses two related requests:
1. **Disable "Email Reminder", "WhatsApp", and "Credit Note" actions when an invoice is fully paid** - across the Invoice Details page header menu, sidebar quick actions, and Transaction Drawer
2. **Send a payment confirmation email when a payment is recorded** - to notify the customer that their payment has been received

---

## Current Behavior Analysis

### Actions That Need Fixing

| Location | Action | Current State | Should Be |
|----------|--------|---------------|-----------|
| Invoice Details - Header "..." menu | Create Credit Note | Shows when issued | Hide when paid |
| Invoice Details - Header "..." menu | Email Reminder | Shows when issued | Hide when paid |
| Invoice Details - Header "..." menu | WhatsApp | Shows when issued | Hide when paid |
| Invoice Details - Sidebar Quick Actions | Create Credit Note | Always shows when issued | Hide when paid |
| Transaction Drawer Footer | Credit Note button | Shows when issued | Hide when paid |

### Actions Already Correct

| Location | Action | Current State |
|----------|--------|---------------|
| Invoice Details - Sidebar Quick Actions | Email/WhatsApp | Already hidden when `isSettled` |
| Invoice Details - Header | Add Payment button | Already hidden when `remainingBalance <= 0` |
| Transaction Drawer Footer | Payment button | Already hidden when `remainingBalance <= 0` |
| Transaction Drawer Footer | Remind button | Already hidden when `remainingBalance <= 0` |
| Invoices List - Menu | Credit Note | Already hidden when status = "paid" |

---

## Implementation Plan

### Part 1: Disable Actions When Invoice is Fully Paid

#### File: `src/pages/InvoiceDetails.tsx`

**Change 1 - Header three-dot menu (lines 685-704):**
- Add `!isSettled` condition to hide "Create Credit Note", "Email Reminder", and "WhatsApp" when the invoice is fully paid
- Users will still see the menu with "Download PDF" option

**Change 2 - Sidebar Quick Actions (line 1415):**
- Add `!isSettled` condition to hide "Create Credit Note" button when paid

#### File: `src/components/transaction-drawer/TransactionFooterActions.tsx`

**Change 3 - Credit Note button (line 84):**
- Add `remainingBalance > 0` condition similar to the "Payment" and "Remind" buttons

---

### Part 2: Payment Confirmation Email

#### Approach

When a payment is recorded and the invoice becomes fully paid OR when any payment is recorded:
1. Invoke a new edge function `send-payment-confirmation` to email the customer
2. The email will include: payment amount, remaining balance (if any), and invoice details
3. Log the send in `document_send_logs` for audit trail

#### File: `supabase/functions/send-payment-confirmation/index.ts` (New)

Create a new edge function that:
- Accepts: `invoiceId`, `paymentAmount`, `paymentMethod`, `customerEmail`, `customerName`, `invoiceNumber`, `remainingBalance`
- Sends a professional email confirming the payment received
- Uses Resend API (already configured with `RESEND_API_KEY`)
- Logs to `document_send_logs` table

Example email content:
```
Subject: Payment Received - Invoice {invoiceNumber}

Dear {customerName},

We have received your payment of €{amount} for Invoice {invoiceNumber}.

{If paid in full: "Your invoice is now fully paid. Thank you for your prompt payment."}
{If partial: "Your remaining balance is €{remainingBalance}."}

Payment Details:
- Amount: €{amount}
- Method: {method}
- Date: {date}

Thank you for your business.
```

#### File: `src/pages/InvoiceDetails.tsx`

**Change 4 - handleAddPayment function (around line 550):**
- After successfully recording the payment
- If the customer has an email address, invoke `send-payment-confirmation` edge function
- Show a toast indicating email was sent (or failed gracefully)

---

## Technical Details

### Condition Logic

For determining if an invoice is "fully paid":
- `isSettled` = `remainingBalance <= 0` (already computed at line 591)
- This accounts for payments AND credit notes applied

### Edge Function Structure

```typescript
// send-payment-confirmation/index.ts
interface PaymentConfirmationRequest {
  invoiceId: string;
  invoiceNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  customerEmail: string;
  customerName: string;
  remainingBalance: number;
  isFullyPaid: boolean;
  userId: string;
  customerId?: string;
}
```

### Error Handling

- If customer has no email: skip sending, no error
- If email send fails: log warning, show toast, but don't fail the payment recording
- Email is optional/nice-to-have, not a blocker

---

## Files to Modify

| File | Type | Changes |
|------|------|---------|
| `src/pages/InvoiceDetails.tsx` | Modify | Add `!isSettled` conditions to header menu and sidebar; call payment confirmation email |
| `src/components/transaction-drawer/TransactionFooterActions.tsx` | Modify | Add `remainingBalance > 0` condition to Credit Note button |
| `supabase/functions/send-payment-confirmation/index.ts` | Create | New edge function for payment confirmation emails |
| `supabase/config.toml` | Modify | Add entry for new function with `verify_jwt = false` |

---

## Expected Behavior After Implementation

| Scenario | Email Reminder | WhatsApp | Credit Note | Add Payment |
|----------|----------------|----------|-------------|-------------|
| Draft invoice | Hidden | Hidden | Hidden | Hidden |
| Issued, unpaid | Visible | Visible | Visible | Visible |
| Issued, partially paid | Visible | Visible | Visible | Visible |
| Issued, fully paid | **Hidden** | **Hidden** | **Hidden** | Hidden |

When payment is recorded:
- Customer receives email confirmation (if email exists)
- Email indicates if fully paid or shows remaining balance
- Activity is logged in `document_send_logs`
