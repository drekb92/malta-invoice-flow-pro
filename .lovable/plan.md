

# Fix Dashboard Metrics Filtering & Duplicate Activity Entries

## Issues Identified

### 1. "Total Collected" shows 0 for "Last 7 days" despite a payment recorded today
**Root cause**: `getDashboardMetrics` in `src/lib/dashboard.ts` calculates "payments collected" by filtering the **invoices** table by `invoice.created_at` and checking `status === "paid"`. INV-2025-001 was created on **2025-10-13** — months ago — so it falls outside any recent date range. The payment itself was recorded today (2026-02-24), but the code never queries the `payments` table at all.

**Fix**: Query the `payments` table directly, filtering by `payments.created_at` (or `payment_date`) within the selected date range. This gives the actual amount collected in the period, independent of when the invoice was originally created.

### 2. Duplicate "Email sent" entries for INV-2025-001
**Root cause**: The database has two `document_send_logs` rows for INV-2025-001, sent 48 seconds apart (09:28:01 and 09:28:49). This is likely because:
- The user clicked "Send" from the invoice page (first entry at 09:28:01)
- The payment confirmation email was also sent automatically after recording the payment (second entry at 09:28:49 via `send-payment-confirmation`)

Both are legitimate logs, but they look confusing in the Recent Activity widget because they both show as "Email sent" with identical descriptions. The fix is to differentiate payment confirmation emails from regular invoice emails in the activity feed description.

### 3. "Today Snapshot" not reflecting the payment
The `getTodaySnapshot` function correctly queries the `payments` table by `created_at >= todayStart`, so this should work. However, the `todayStart` uses `setHours(0, 0, 0, 0)` which produces a **local** midnight, then `.toISOString()` converts to UTC. This is correct as long as the user's timezone is ahead of UTC (Malta is UTC+1), so midnight local = 23:00 UTC previous day. The payment at 09:28 UTC should be captured. No change needed here.

---

## Changes

### A. `src/lib/dashboard.ts` — Fix payments metric to use `payments` table

In `getDashboardMetrics`, add a separate query to the `payments` table:

```tsx
// Current (broken): derives "collected" from invoices with status "paid"
const payments = invoices?.filter((inv) => inv.status === "paid")
  .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

// New: query actual payments table with date range filter
let paymentsQuery = supabase
  .from("payments")
  .select("amount, created_at")
  .eq("user_id", userId);

if (startISO) paymentsQuery = paymentsQuery.gte("created_at", startISO);
if (filterCustomer) {
  // Join through invoices to filter by customer
  paymentsQuery = paymentsQuery.eq("invoices.customer_id", filterCustomer);
}

const { data: paymentRows } = await paymentsQuery;
const payments = paymentRows?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
```

For customer filtering on payments, since payments link to invoices (not directly to customers), we need to join through invoices. The simplest approach: when a customer filter is active, first get invoice IDs for that customer, then filter payments by those invoice IDs.

### B. `src/components/RecentActivity.tsx` — Deduplicate / differentiate email entries

The two send logs are both valid records but need differentiation. The payment confirmation email (sent by the `send-payment-confirmation` edge function) currently logs with `document_type: "invoice"` and `channel: "email"`, making it indistinguishable from a manual email send.

**Approach**: Group consecutive `document_send_logs` entries with the same `document_number` and `channel` within a short window (e.g., 60 seconds) and only show the latest one. This prevents near-duplicate entries from cluttering the feed.

```tsx
// After building the sendLogs activities, deduplicate:
// Group by document_number + channel, keep only the latest within 60s windows
const deduped = sendActivities.filter((activity, index, arr) => {
  const next = arr[index - 1]; // already sorted desc
  if (!next) return true;
  if (next.description === activity.description) {
    const diff = Math.abs(next.timestamp.getTime() - activity.timestamp.getTime());
    if (diff < 60000) return false; // skip duplicate within 60s
  }
  return true;
});
```

---

## Summary of file changes

| File | Change |
|------|--------|
| `src/lib/dashboard.ts` | Query `payments` table for "Total Collected" metric instead of deriving from invoice status; apply date range filter on `payments.created_at` |
| `src/components/RecentActivity.tsx` | Deduplicate send log entries for the same document within a 60-second window to prevent duplicate "Email sent" rows |

