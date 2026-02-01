

# Dashboard Layout Improvements

Reorganizing the dashboard to align all boxes consistently, reduce the Recent Activity length, move More Actions higher, and remove the Malta VAT Compliance box.

---

## Current Layout Issues

| Issue | Current State | Problem |
|-------|---------------|---------|
| Quick Invoice / Overdue boxes | Same row as Pending Reminders | Height stretches to match the taller Pending Reminders widget |
| Recent Activity | Shows 8 items | Too long, takes excessive vertical space |
| More Actions | At the bottom of the page | Users have to scroll to see it |
| Malta VAT Compliance box | Shows between Quick Actions and More Actions | User requested removal |

---

## Proposed New Layout

```text
+--------------------------------------------------+
| Dashboard Header (remains unchanged)              |
+--------------------------------------------------+
| Metrics Grid - 4 cards (unchanged)               |
+--------------------------------------------------+
| Quick Invoice | Overdue Invoices | More Actions  |  <- New row
+--------------------------------------------------+
| Pending Reminders       | Recent Activity        |  <- Combined row
+--------------------------------------------------+
| Currency Info (unchanged)                         |
+--------------------------------------------------+
```

---

## Technical Changes

### File: `src/pages/Index.tsx`

**Change 1: Remove Malta VAT Compliance Box**
- Delete lines 574-598 (the blue alert box with Malta VAT info)

**Change 2: Restructure Quick Actions Row**
- Move More Actions section up into the same row as Quick Invoice and Overdue Invoices
- Change the Quick Actions row from 3 compact cards to include "More Actions" as a third card
- Convert the current "More Actions" grid section into a single compact card with an expandable dropdown or reduced button set

**Change 3: Create Combined Second Row**
- Create a new 2-column grid row below Quick Actions
- Left side: Pending Reminders Widget (50% width)
- Right side: Recent Activity (50% width)

**Change 4: Add height constraints to balance cards**
- Add `self-start` class to Quick Invoice and Overdue Invoices cards to prevent stretching
- Or use `items-start` on the parent grid to align all cards to top

---

### File: `src/components/RecentActivity.tsx`

**Change: Reduce activity limit from 8 to 5**
- Line 162: Change `.slice(0, 8)` to `.slice(0, 5)`

This reduces the vertical height of the Recent Activity card.

---

## Layout Changes in Detail

### New Quick Actions Row (Top Row)

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 items-start">
  {/* Quick Invoice Card */}
  <Card>...</Card>
  
  {/* Overdue Invoices Card */}
  <Card>...</Card>
  
  {/* More Actions Card - NEW COMPACT VERSION */}
  <Card>
    <CardHeader>
      <CardTitle>More Actions</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => navigate("/customers")}>
          <Users /> Customers
        </Button>
        <Button variant="outline" onClick={() => navigate("/credit-notes")}>
          <FileSpreadsheet /> Credit Notes
        </Button>
        <Button variant="outline" onClick={() => navigate("/reports")}>
          <BarChart3 /> Reports
        </Button>
        <Button variant="outline" onClick={() => navigate("/invoices/export")}>
          <Download /> Export
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
```

### New Second Row (Pending Reminders + Recent Activity)

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
  {/* Pending Reminders - Left side */}
  <PendingRemindersWidget ... />
  
  {/* Recent Activity - Right side */}
  <RecentActivity userId={userId} />
</div>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Remove VAT compliance box, restructure layout, move More Actions up |
| `src/components/RecentActivity.tsx` | Reduce activity limit from 8 to 5 |

---

## Visual Result

After implementation:
- All three top cards (Quick Invoice, Overdue, More Actions) will align at the top and not stretch
- More Actions is now visible without scrolling
- Pending Reminders and Recent Activity share a row below, balanced in width
- Recent Activity shows only 5 items instead of 8
- Malta VAT Compliance box is removed entirely
- Cleaner, more compact dashboard with better visual hierarchy

