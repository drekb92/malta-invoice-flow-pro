

# Polish Work Queue List Layout

## File: `src/components/WorkQueueCard.tsx`

### Changes

**1. Add a subtle header row to both tabs**

Before the list of items in each tab, insert a muted label row with columns: Invoice, Customer, Amount, Status/Overdue, and Action. The header uses `text-[11px] text-muted-foreground uppercase tracking-wide` styling with a bottom border divider.

```tsx
{/* Header row - shown only when items exist */}
<div className="flex items-center gap-2 px-3 pb-1.5 mb-1 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
  <span className="w-[100px] shrink-0">Invoice</span>
  <span className="flex-1 min-w-0">Customer</span>
  <span className="w-[90px] text-right shrink-0">Amount</span>
  <span className="w-[80px] text-right shrink-0">Overdue</span>  {/* or "Status" for Needs Sending tab */}
  <span className="w-[72px] text-right shrink-0">Action</span>
</div>
```

**2. Reduce row vertical padding**

Change each data row from `py-2 px-3` to `py-1.5 px-3` for a more compact feel.

**3. Use fixed column widths for consistent alignment**

Replace the current flex-based layout with explicit widths matching the header columns. Amount and Overdue/Status columns get `text-right` alignment.

**4. Replace `space-y-1` with dividers between rows**

Remove the `space-y-1` wrapper and instead apply `divide-y divide-border/60` on the row container so rows are separated by subtle lines instead of gaps.

### Detailed row structure (Follow-up Queue tab)

```tsx
<div className="divide-y divide-border/60 pr-1">
  {topOverdueInvoices.map((invoice) => (
    <div key={invoice.id} className="flex items-center gap-2 py-1.5 px-3 hover:bg-muted/50 transition-colors">
      <Link to={...} className="w-[100px] shrink-0 font-medium text-sm truncate ...">
        {invoice.invoice_number}
      </Link>
      <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
        {invoice.customer_name}
      </span>
      <span className="w-[90px] text-right text-sm font-medium tabular-nums shrink-0">
        {formatCurrency(invoice.total_amount)}
      </span>
      <div className="w-[80px] flex justify-end shrink-0">
        <Badge ...>{invoice.days_overdue}d</Badge>
      </div>
      <div className="w-[72px] flex justify-end shrink-0">
        <Button ...>Remind</Button>
      </div>
    </div>
  ))}
</div>
```

### Needs Sending tab

Same structure, but the 4th column header reads **Status** instead of **Overdue**, and shows the Draft/Not sent badge.

### Summary of changes

| Aspect | Before | After |
|--------|--------|-------|
| Header row | None | Muted label row with column names |
| Row padding | `py-2` | `py-1.5` |
| Row separation | `space-y-1` (gaps) | `divide-y divide-border/60` (subtle lines) |
| Amount alignment | Inline, inconsistent | Fixed width, right-aligned |
| Overdue/Status alignment | Inline with action | Fixed width, right-aligned |
| Column widths | Flexible/auto | Fixed widths matching header |

Only one file is modified: `src/components/WorkQueueCard.tsx`.
