
# Fix Sticky Table Headers on Invoices Page

## Problem
The `sticky top-0` classes on `TableHead` cells don't work because the `Table` component wraps the `<table>` in a `<div className="overflow-x-auto">`. Any `overflow` property (other than `visible`) on an ancestor creates a new scroll container, which prevents `position: sticky` from sticking relative to the viewport.

## Solution
Move the sticky behavior from individual `<th>` cells to the `<thead>` element, and update the `Table` wrapper to not block sticky positioning.

### Changes

**1. `src/components/ui/table.tsx` — Remove `overflow-x-auto` from wrapper**

Change the Table wrapper from `overflow-x-auto` to `overflow-x-visible` (or remove overflow entirely). Since the invoices table fits within the viewport width, horizontal scroll isn't needed here. To avoid breaking other tables that may need horizontal scroll, we'll keep the wrapper but make its overflow configurable by allowing className overrides to reach the wrapper div.

Actually, the simplest fix: change `overflow-x-auto` to `overflow-x-auto overflow-y-visible` so that vertical sticky still works. Unfortunately, CSS does not allow `overflow-x: auto` with `overflow-y: visible` — browsers convert `visible` to `auto` when the other axis is not `visible`.

**Best approach**: Remove `overflow-x-auto` from the Table component's wrapper entirely and instead apply it only where needed via className. This keeps the component flexible.

Replace the wrapper:
```tsx
<div className="relative w-full">
```
(Remove `overflow-x-auto` — pages that need horizontal scroll can add it themselves.)

**2. `src/pages/Invoices.tsx` — Apply sticky to `<TableHeader>` instead of individual cells**

Replace the individual `sticky top-0 z-20 bg-card shadow-sm` on each `<TableHead>` with a single sticky class on `<TableHeader>`:

```tsx
<TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
  <TableRow>
    <TableHead>Invoice #</TableHead>
    <TableHead>Customer</TableHead>
    <TableHead>Amount</TableHead>
    <TableHead>Status</TableHead>
    <TableHead>Issue Date</TableHead>
    <TableHead>Due Date</TableHead>
    <TableHead className="text-right">Actions</TableHead>
  </TableRow>
</TableHeader>
```

Note: `<thead>` with `position: sticky` works in modern browsers. The `bg-card` ensures the header has an opaque background so content scrolling beneath it is hidden. The subtle `shadow` replaces the border for a clean separation line.

### Why this works
- Removing `overflow-x-auto` from the Table wrapper means the nearest scroll ancestor for `sticky` is the viewport (the page itself)
- `sticky top-0` on `<thead>` pins the entire header row to the top of the viewport when scrolling
- The `bg-card` background and shadow ensure readability over scrolled content

### Risk
- Other pages using `<Table>` that relied on `overflow-x-auto` for horizontal scrolling will lose that. A quick search will confirm if any other table needs it — if so, those pages can add `overflow-x-auto` to their own wrapper.
