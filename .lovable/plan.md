
# Fix Work Queue Overflow — Responsive Compact List Layout

## File: `src/components/WorkQueueCard.tsx`

### Problem
The current fixed-width table layout (with 140px + flex + 140px + 120px + 120px columns) overflows horizontally when the card is in a 6-column grid. The fixed widths total ~660px minimum, which exceeds the available space.

### Solution
Replace the table-style layout with a responsive compact list where each row uses a flexible two-part structure (left info + right actions) that never overflows.

### New Row Structure

**Follow-up Queue rows:**
```
[Invoice# (bold)]          [Amount (bold)]
[Customer (muted)]    [Overdue badge] [Remind btn]
```

**Needs Sending rows:**
```
[Invoice# (bold)]          [Amount (bold)]
[Customer (muted)]    [Status badge]  [Send btn]
```

### Detailed Changes

**1. Remove the table header rows entirely**
Delete the fixed-width header divs (lines 173-178 and 269-274). The compact list layout is self-explanatory and doesn't need column headers.

**2. Replace Follow-up Queue rows (lines 180-236)**
Each row becomes:
```tsx
<div className="flex items-start justify-between gap-2 py-2 px-3 hover:bg-muted/50 transition-colors">
  {/* Left side: invoice + customer stacked */}
  <div className="min-w-0 flex-1">
    <Link to={`/invoices/${invoice.id}`} className="text-sm font-medium hover:text-primary truncate block">
      {invoice.invoice_number}
    </Link>
    <span className="text-xs text-muted-foreground truncate block">
      {invoice.customer_name}
    </span>
  </div>
  {/* Right side: amount, badge, button */}
  <div className="flex items-center gap-2 shrink-0">
    <div className="text-right">
      <span className="text-sm font-medium tabular-nums block">{amount}</span>
      <span className="overdue-badge...">{invoice.days_overdue}d</span>
    </div>
    <Button size="sm" className="h-7 px-2 text-xs">
      <Bell className="h-3 w-3" />
    </Button>
  </div>
</div>
```

**3. Replace Needs Sending rows (lines 276-313)**
Same two-part structure but with Status badge and Send button instead.

**4. Update container styling**
- Remove `max-w-[700px]` constraints (no longer needed)
- Add `overflow-hidden` to prevent any horizontal scroll
- The card already has `max-h-[360px]` and the tab content has `overflow-auto` for vertical scrolling
- Keep `divide-y divide-border/60` for subtle row dividers

**5. Compact Remind button**
Change the Remind button to icon-only (just the Bell icon, no text) to save horizontal space. The Send button similarly becomes icon-only with just the Send icon.

### What stays the same
- Card header with tabs and "View all" link
- Empty state messages
- "X more need attention" / "X more to send" footer links
- Max 6 visible rows
- All click handlers and send logic
- Overdue badge severity colors
