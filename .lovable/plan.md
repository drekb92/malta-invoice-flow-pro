

# Dashboard Quick Actions Enhancement

Adding a Quick Quotation button and balancing the card sizes in the dashboard's Quick Actions row.

---

## Changes Requested

| Change | Current State | Target State |
|--------|---------------|--------------|
| Quick Quotation | Not present | Add as quick button similar to Quick Invoice |
| Export button | Present in More Actions | Remove it |
| Card alignment | More Actions slightly taller due to 2x2 grid | All three cards same height |

---

## Technical Implementation

### File: `src/pages/Index.tsx`

**Change 1: Add Quotation Icon Import**

Add `FileEdit` or use existing `FileText` icon for quotation (line ~35-49 imports section).

**Change 2: Convert Quick Invoice Card to Quick Invoice + Quotation Card**

Rename the card to "Quick Create" and add both buttons:

```tsx
{/* Quick Create Card */}
<Card className="flex flex-col">
  <CardHeader className="pb-3">
    <CardTitle className="text-base font-semibold flex items-center gap-2">
      <Plus className="h-4 w-4 text-primary" />
      Quick Create
    </CardTitle>
  </CardHeader>
  <CardContent className="flex-1 space-y-2">
    {/* Existing Invoice Dropdown */}
    <DropdownMenu>...</DropdownMenu>
    
    {/* NEW: Quotation Button */}
    <Button 
      variant="outline" 
      className="w-full" 
      size="lg"
      onClick={() => navigate("/quotations/new")}
    >
      <FileText className="h-4 w-4 mr-2" />
      New Quotation
    </Button>
  </CardContent>
</Card>
```

**Change 3: Remove Export Button from More Actions**

Remove lines 602-610 (the Export button), leaving only 3 buttons:
- Customers
- Credit Notes  
- Reports

**Change 4: Balance Card Heights**

Add `flex flex-col` to all three cards and `flex-1` to CardContent to ensure equal heights:

```tsx
<Card className="flex flex-col">
  <CardHeader className="pb-3">...</CardHeader>
  <CardContent className="flex-1">...</CardContent>
</Card>
```

---

## Resulting Layout

```text
+--------------------------------------------------+
| Quick Create      | Overdue Invoices | More Actions |
|-------------------|------------------|--------------|
| [Invoice ▼]       | [Follow Up ▼]    | [Customers]  |
| [New Quotation]   | X days overdue   | [Credit Notes]|
| X customers       | Total: €XXX      | [Reports]    |
+--------------------------------------------------+
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add Quotation button, remove Export button, balance card heights with flex classes |

---

## Visual Result

After implementation:
- Quick Create card has both Invoice dropdown and New Quotation button
- More Actions has 3 buttons (Customers, Credit Notes, Reports) - Export removed
- All three cards are the same height due to flex layout
- Clean, balanced appearance with quick access to create both invoices and quotations

