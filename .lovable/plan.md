
# Quotation Status Automation

## Overview
Hardcode "draft" status on creation and automatically expire quotations past their Valid Until date.

## Changes

### 1. `src/pages/NewQuotation.tsx` — Force "draft" on creation

- In `handleSubmit`, hardcode `status: "draft"` in the payload for new quotations (non-edit mode) instead of using the `status` state variable.
- The `status` state variable and `setStatus` can be removed entirely since the dropdown was already removed and it's no longer used elsewhere in creation flow.
- In edit mode, keep using the existing `status` from the loaded quotation (no change).

### 2. `src/pages/Quotations.tsx` — Auto-expire on fetch

- After fetching quotations, loop through the results and identify any quotation where:
  - `status` is NOT `accepted` or `converted`
  - `valid_until` date is before today
  - `status` is not already `expired`
- For those quotations, batch-update their status to `expired` in Supabase.
- Apply the updated status in the local state so the UI reflects the change immediately without a second fetch.

### Technical Details

**NewQuotation.tsx payload change (line ~238):**
```tsx
// For new quotations, always "draft"
status: isEditMode ? status : "draft",
```

Also remove the unused `status`/`setStatus` state since the dropdown is gone and creation always uses "draft".

**Quotations.tsx — auto-expire logic after fetch (after line ~129):**
```tsx
const today = new Date().toISOString().split("T")[0];
const toExpire = (data || []).filter(
  (q) => q.valid_until < today && !["accepted", "converted", "expired"].includes(q.status)
);

if (toExpire.length > 0) {
  await supabase
    .from("quotations")
    .update({ status: "expired" })
    .in("id", toExpire.map((q) => q.id));

  // Update local state
  const expiredIds = new Set(toExpire.map((q) => q.id));
  const updated = (data || []).map((q) =>
    expiredIds.has(q.id) ? { ...q, status: "expired" } : q
  );
  setQuotations(updated);
  setFiltered(updated);
} else {
  setQuotations(data || []);
  setFiltered(data || []);
}
```

This runs each time quotations are loaded, so expired status is always up-to-date without needing a cron job or database trigger.
