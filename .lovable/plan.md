

## Dashboard Card Fixes

### 1. Simplify Today Snapshot Card
**File: `src/components/TodaySnapshotCard.tsx`**
- Remove the "Updated HH:MM" timestamp in the header
- Remove the bottom "Activity recorded today" / "No activity yet today" status bar
- The card already clearly shows today's data — these elements are redundant clutter

### 2. Exclude Drafts from Outstanding & Invoices Issued Metrics
**File: `src/lib/dashboard.ts` → `getDashboardMetrics()`**

Currently the invoices query fetches ALL invoices (including drafts). This inflates both the "Outstanding" and "Invoices Issued" KPI cards.

Fix: Add `.neq("status", "draft")` to the invoices query so only issued/paid/void invoices are counted. This means:
- **Outstanding** = sum of non-paid, non-draft invoices (correct: drafts aren't owed yet)
- **Invoices Issued** = count of non-draft invoices (correct: drafts haven't been issued)
- **Invoices Total** = sum of non-draft invoices

### 3. "View All" Link Destinations — No Change Needed
After review, the current routing is correct:
- **Outstanding** → `/invoices?status=unpaid` (correct — shows unpaid invoices)
- **Customers** → `/customers` (already goes to customers page)
- **Collected** → `/invoices?status=paid` (correct — no separate payments page exists)
- **Invoices Issued** → `/invoices` (correct — shows the invoices list)

There is no separate "Payments" or "Reports" page that would be a better destination. The current links are appropriate.

### Files to modify
- `src/components/TodaySnapshotCard.tsx` — remove timestamp and activity status bar
- `src/lib/dashboard.ts` — add `.neq("status", "draft")` filter to metrics query

