# Invoice Status + Delivery Model Implementation

## ✅ COMPLETED

This implementation cleaned up the invoice status model to use strictly `draft`, `issued`, and `void` as document states, and introduced delivery tracking fields directly on the invoices table.

---

## Changes Made

### 1. Database Migration
Added delivery tracking columns to `invoices` table:
- `last_sent_at` (TIMESTAMPTZ) - Timestamp of most recent send
- `last_sent_channel` (TEXT) - Channel used: email, whatsapp, or manual
- `last_sent_to` (TEXT) - Recipient email/phone

### 2. Edge Functions Updated
- **`send-document-email`**: Now updates `last_sent_at`, `last_sent_channel`, `last_sent_to` after successful email send
- **`create-document-share-link`**: Now updates delivery fields after WhatsApp share link creation

### 3. Frontend Changes
- **`statusBadges.tsx`**: Added `void` status style
- **`TransactionDrawerHeader.tsx`**: Now displays "Last sent" info below customer name
- **`TransactionDrawer.tsx`**: Fetches and passes delivery fields to header
- **`Invoices.tsx`**: Shows delivery info under status badge in table

---

## Technical Notes

### Status Model
- `invoices.status` stores: `draft`, `issued`, or `void`
- Payment statuses (`paid`, `partially_paid`, `overdue`) are computed client-side
- No code uses `status = "sent"` for invoices

### Delivery Tracking
- Denormalized fields on invoices for fast single-query access
- `document_send_logs` retained for full audit trail
- Both systems serve different purposes
