
# Invoice Status + Delivery Model Implementation

## Overview

This implementation will clean up the invoice status model to use strictly `draft`, `issued`, and `void` as document states, and introduce delivery tracking fields directly on the invoices table. This provides a simpler, more accurate model where delivery status ("last sent") is tracked separately from the document's lifecycle status.

---

## Current State Analysis

### Existing Status Model
- The `invoices.status` column currently stores various values including payment-related states
- The `src/lib/invoiceStatus.ts` already defines the correct model: `draft | issued | void` for document state
- Payment status (`paid`, `partial`, `overdue`) is correctly computed from payment history and due dates
- No code uses `status = "sent"` (confirmed via search)

### Existing Delivery Tracking
- The `document_send_logs` table already tracks send history (email, WhatsApp)
- Edge functions (`send-document-email`, `create-document-share-link`) log to this table
- The `useDocumentSendLogs` hook fetches the latest send for display in the UI
- This provides a full audit trail but requires a join to get the "last sent" info

### Proposed Improvement
Adding `last_sent_at`, `last_sent_channel`, and `last_sent_to` directly on invoices provides:
- Fast single-query access to delivery status
- Simpler UI rendering without additional hooks
- Consistent "Last sent" display across list views and detail pages

---

## Database Changes

### Migration: Add Delivery Tracking Columns to Invoices

```sql
ALTER TABLE invoices 
ADD COLUMN last_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN last_sent_channel TEXT DEFAULT NULL,
ADD COLUMN last_sent_to TEXT DEFAULT NULL;

COMMENT ON COLUMN invoices.last_sent_at IS 'Timestamp of most recent send (email/whatsapp/manual)';
COMMENT ON COLUMN invoices.last_sent_channel IS 'Channel used for last send: email, whatsapp, or manual';
COMMENT ON COLUMN invoices.last_sent_to IS 'Recipient of last send (email address or phone number)';
```

The `last_sent_channel` will accept: `email`, `whatsapp`, or `manual`

---

## Backend Changes

### 1. Update `send-document-email` Edge Function

After successful email send (currently just logs to `document_send_logs`), also update the invoice:

```typescript
// After logging to document_send_logs, update the invoice delivery fields
if (documentType === 'invoice') {
  await supabase
    .from('invoices')
    .update({
      last_sent_at: new Date().toISOString(),
      last_sent_channel: 'email',
      last_sent_to: to,
    })
    .eq('id', documentId);
}
```

### 2. Update `create-document-share-link` Edge Function

After successful WhatsApp share link creation, update the invoice:

```typescript
// After logging to document_send_logs, update the invoice delivery fields
if (documentType === 'invoice') {
  await supabase
    .from('invoices')
    .update({
      last_sent_at: new Date().toISOString(),
      last_sent_channel: 'whatsapp',
      last_sent_to: customerId ? 'customer' : 'manual',
    })
    .eq('id', documentId);
}
```

---

## Frontend Changes

### 1. Update `src/lib/invoiceStatus.ts`

Remove any reference to "sent" status and ensure DocumentStatus is strictly:
```typescript
export type DocumentStatus = 'draft' | 'issued' | 'void';
```

The file already follows this model - no changes needed here.

### 2. Update `src/components/transaction-drawer/statusBadges.tsx`

Remove the `sent` status style (currently exists for quotations, not used for invoices):

```typescript
const STATUS_STYLES = {
  draft: "...",
  issued: "...",
  void: "...",  // Add void styling
  paid: "...",
  partially_paid: "...",
  overdue: "...",
  // Quote-specific (keep for quotations)
  sent: "...",
  accepted: "...",
  // ...
};
```

Add a `void` style:
```typescript
void: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
```

### 3. Update Invoice List (`src/pages/Invoices.tsx`)

Update the Invoice interface to include new fields:
```typescript
interface Invoice {
  // ... existing fields
  last_sent_at?: string;
  last_sent_channel?: 'email' | 'whatsapp' | 'manual';
  last_sent_to?: string;
}
```

Update the status badge display to show delivery info below:
```tsx
<TableCell>
  <div className="flex flex-col gap-1">
    <Badge className={statusBadge.className}>
      {statusBadge.label}
    </Badge>
    {invoice.last_sent_at && (
      <span className="text-xs text-muted-foreground">
        Sent {format(new Date(invoice.last_sent_at), "dd MMM")} via {invoice.last_sent_channel}
      </span>
    )}
  </div>
</TableCell>
```

### 4. Update `TransactionDrawerHeader`

Add optional delivery info display below the status badge:
```tsx
interface TransactionDrawerHeaderProps {
  // ... existing props
  lastSentAt?: string;
  lastSentChannel?: string;
}

// In the render:
{lastSentAt && (
  <span className="text-xs text-muted-foreground ml-2">
    Last sent: {format(new Date(lastSentAt), "dd MMM, HH:mm")} via {lastSentChannel}
  </span>
)}
```

### 5. Update Invoice Details Sidebar (`src/pages/InvoiceDetails.tsx`)

The sidebar currently shows send status from `useDocumentSendLogs`. We can simplify this to read from the invoice directly:

```tsx
// In the Send Status section, use invoice.last_sent_at instead of lastEmailSent
{invoice.last_sent_at ? (
  <div className="flex items-center gap-1.5 text-xs">
    <CheckCircle className="h-3 w-3 text-green-600" />
    <span>Last sent: {format(new Date(invoice.last_sent_at), "dd MMM, HH:mm")}</span>
    <span className="text-muted-foreground">via {invoice.last_sent_channel}</span>
  </div>
) : (
  <span className="text-xs text-muted-foreground">Not sent yet</span>
)}
```

Note: Keep the `useDocumentSendLogs` hook for the full activity/history panel - it provides the complete audit trail.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/` | New migration for delivery columns |
| `supabase/functions/send-document-email/index.ts` | Update invoice after email send |
| `supabase/functions/create-document-share-link/index.ts` | Update invoice after share link |
| `src/pages/Invoices.tsx` | Add delivery info display in list |
| `src/pages/InvoiceDetails.tsx` | Update sidebar to show last_sent_at |
| `src/components/TransactionDrawer.tsx` | Pass delivery fields to header |
| `src/components/transaction-drawer/TransactionDrawerHeader.tsx` | Display "Last sent" info |
| `src/components/transaction-drawer/statusBadges.tsx` | Add `void` status style |

---

## Technical Notes

### Status Clarification
- `invoices.status` will only store: `draft`, `issued`, or `void`
- Payment-related statuses (`paid`, `partially_paid`, `overdue`) are computed client-side
- The existing `getStatusBadge()` functions already handle this correctly

### Backward Compatibility
- Existing invoices with other status values will continue to work
- The UI already handles unknown statuses gracefully
- No data migration needed for existing status values

### Why Not Remove `document_send_logs`?
- Keep it for full audit trail (who sent what, when, to whom)
- The new invoice fields are denormalized for quick access
- Both systems serve different purposes

---

## Implementation Sequence

1. Create database migration to add the three new columns
2. Update `send-document-email` edge function to update invoice
3. Update `create-document-share-link` edge function to update invoice
4. Update `statusBadges.tsx` to add void style
5. Update `Invoices.tsx` to display delivery info
6. Update `InvoiceDetails.tsx` sidebar
7. Update `TransactionDrawer.tsx` and header component
8. Test end-to-end: send email, verify invoice updated, verify UI shows "Last sent"
