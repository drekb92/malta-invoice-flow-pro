
# Dashboard 12-Column Grid Layout Refactor

## Overview
Restructure the Dashboard page to use a proper 12-column responsive grid system with a main content area (8 columns) and a sidebar (4 columns). This will create a more organized, scannable layout with clear visual hierarchy.

## Target Layout

```text
+--------------------------------------------------------------+
| Top Toolbar (full width - 12 cols)                           |
| [Search...] [Date filter] [Customer filter]      [New ▼]     |
+--------------------------------------------------------------+
| KPI Row (full width - 12 cols = 4 x 3 cols each)             |
| [Outstanding] [Customers] [Collected] [Invoices Issued]      |
+--------------------------------------------------------------+
|                                              |                |
| Main Content (8 cols)                        | Sidebar (4 col)|
| +------------------------------------------+ | +------------+ |
| | Work Queue (Tabbed)                      | | | Today      | |
| | [Reminders] [Needs Sending]              | | | Snapshot   | |
| |                                          | | |            | |
| +------------------------------------------+ | +------------+ |
| +------------------------------------------+ | +------------+ |
| | Receivables Aging                        | | | Recent     | |
| |                                          | | | Activity   | |
| +------------------------------------------+ | +------------+ |
|                                              |                |
+--------------------------------------------------------------+
```

## Implementation Steps

### 1. Create Work Queue Tabbed Component
Create a new component `WorkQueueCard.tsx` that combines Pending Reminders and Needs Sending into a single tabbed interface.

**File:** `src/components/WorkQueueCard.tsx`

- Uses Radix UI Tabs component
- Two tabs: "Follow-up Queue" (pending reminders) and "Needs Sending"
- Each tab displays its respective content
- Shared "View all" link updates based on active tab

### 2. Refactor Dashboard Grid Layout

**File:** `src/pages/Index.tsx`

- **Desktop Layout (lg breakpoint and up)**:
  - Full-width toolbar row
  - Full-width KPI row (4 cards in `grid-cols-4`)
  - 12-column grid: `grid-cols-12`
    - Main content: `col-span-8`
    - Sidebar: `col-span-4`

- **Tablet Layout (md breakpoint)**:
  - Stack main content and sidebar vertically
  - KPI cards: 2 per row

- **Mobile Layout**:
  - Single column layout
  - Keep existing mobile-first ordering
  - FAB remains for quick actions

### 3. Update Toolbar
Modify `DashboardCommandBar.tsx` to include the "New" button in the same row as filters (already implemented, minor positioning adjustments).

### 4. Spacing and Alignment
- Consistent vertical gap between all cards: `gap-6`
- Cards stretch to fill available height where appropriate
- Equal padding and margins throughout

---

## Technical Details

### Grid CSS Structure

```tsx
{/* Desktop: 12-column grid */}
<div className="grid grid-cols-12 gap-6">
  {/* Main Content - 8 columns */}
  <div className="col-span-12 lg:col-span-8 space-y-6">
    <WorkQueueCard ... />
    <ReceivablesAgingCard ... />
  </div>
  
  {/* Sidebar - 4 columns */}
  <div className="col-span-12 lg:col-span-4 space-y-6">
    <TodaySnapshotCard ... />
    <RecentActivity ... />
  </div>
</div>
```

### WorkQueueCard Component Structure

```tsx
<Card>
  <CardHeader>
    <Tabs defaultValue="reminders">
      <TabsList>
        <TabsTrigger value="reminders">Follow-up Queue</TabsTrigger>
        <TabsTrigger value="sending">Needs Sending</TabsTrigger>
      </TabsList>
    </Tabs>
  </CardHeader>
  <CardContent>
    <TabsContent value="reminders">
      {/* Pending reminders content */}
    </TabsContent>
    <TabsContent value="sending">
      {/* Needs sending content */}
    </TabsContent>
  </CardContent>
</Card>
```

### Mobile Responsive Behavior
- On mobile (`< lg`): Full 12-column span for all sections, stacked vertically
- Toolbar filters stack vertically on mobile (existing behavior preserved)
- FAB remains visible on mobile for quick actions

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/WorkQueueCard.tsx` | Create | New tabbed component combining reminders and needs sending |
| `src/pages/Index.tsx` | Modify | Implement 12-column grid layout |
| `src/components/DashboardCommandBar.tsx` | Minor tweak | Ensure proper alignment in toolbar |

## Visual Rhythm Consistency
- All cards use consistent padding: `p-5` or `p-6`
- Vertical spacing between rows: `gap-6` (24px)
- Card headers use `pb-3` for consistent title spacing
- Typography hierarchy maintained across all sections
