

# Fix Work Queue Table Spacing and Alignment

## File: `src/components/WorkQueueCard.tsx`

### Problem
The Amount, Overdue, and Action columns stretch too far right because the flex layout fills the full container width, creating excessive gaps between the Customer column and the right-side columns.

### Solution
Update column widths to the requested values and wrap the table content in a `max-w-[700px]` container so it doesn't stretch across wide screens. Center-align the Overdue/Status column. Reduce row height slightly.

### Column width changes

| Column | Before | After |
|--------|--------|-------|
| Invoice | `w-[100px]` | `w-[140px]` |
| Customer | `flex-1` | `flex-1` (unchanged) |
| Amount | `w-[90px]` | `w-[140px]` right-aligned |
| Overdue/Status | `w-[80px]` | `w-[120px]` center-aligned |
| Action | `w-[72px]` | `w-[120px]` right-aligned |

### Detailed changes

**1. Wrap table content in a max-width container**

Add `max-w-[700px]` to the header row and the row container so content stays compact and doesn't stretch edge-to-edge on wide cards.

**2. Update header row widths (both tabs)**

```tsx
<div className="flex items-center gap-1.5 px-3 pb-1.5 mb-1 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wider max-w-[700px]">
  <span className="w-[140px] shrink-0">Invoice</span>
  <span className="flex-1 min-w-0">Customer</span>
  <span className="w-[140px] text-right shrink-0">Amount</span>
  <span className="w-[120px] text-center shrink-0">Overdue</span>
  <span className="w-[120px] text-right shrink-0">Action</span>
</div>
```

For the Needs Sending tab, the 4th column reads "Status" instead of "Overdue".

**3. Update data row widths and reduce gaps**

- Change row `gap-2` to `gap-1.5` to tighten spacing
- Change `py-1.5` to `py-1` for slightly shorter rows
- Add `max-w-[700px]` to the row container
- Update each column cell to match new widths
- Change Overdue/Status from `justify-end` to `justify-center`

**4. Apply to both tabs**

Both the Follow-up Queue and Needs Sending tabs get the same width and alignment updates.

### Technical details

All changes are in a single file: `src/components/WorkQueueCard.tsx`. The changes touch:
- Lines 173-178 (Follow-up header row)
- Lines 180-235 (Follow-up data rows)
- Lines 269-274 (Needs Sending header row)  
- Lines 276-313 (Needs Sending data rows)

