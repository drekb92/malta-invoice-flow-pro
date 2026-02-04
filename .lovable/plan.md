
# Fix: Quotation View Navigation 404 Error

## Problem Summary

When attempting to view a quotation from the dropdown menu or TransactionDrawer, users see a 404 error because the app navigates to `/quotations/{id}` - a route that doesn't exist.

**Console errors observed:**
```
404 Error: User attempted to access non-existent route: /quotations/0aad97b8-79b1-4fcf-99be-2c76fbe7ebb9
404 Error: User attempted to access non-existent route: /quotations/5dfa82cc-2a80-45dd-b109-d36fe46d71b3
```

---

## Root Cause

The routing structure differs between invoices and quotations:

| Document | View Route | Edit Route | Detail Page |
|----------|------------|------------|-------------|
| Invoice | `/invoices/:id` | `/invoices/edit/:id` | `InvoiceDetails.tsx` |
| Quotation | **Missing** | `/quotations/:id/edit` | None |

The code incorrectly tries to navigate to `/quotations/:id` which doesn't exist. Additionally, there's a mismatched edit URL pattern.

---

## Current Navigation Issues

| Location | Current Code | Problem |
|----------|--------------|---------|
| `Quotations.tsx` line 643 | `<Link to={/quotations/${q.id}}>` | Route doesn't exist |
| `Quotations.tsx` line 649 | `<Link to={/quotations/edit/${q.id}}>` | Wrong format (should be `/:id/edit`) |
| `TransactionDrawer.tsx` line 343 | `navigate(/quotations/${transaction.id})` | Route doesn't exist |

---

## Solution

Since quotations don't have a dedicated detail page (and the drawer already provides view functionality when clicking the quotation number), the fix is to:

1. **Change "View" menu item** to open the TransactionDrawer instead of navigating
2. **Fix "Edit" link** to use the correct route format: `/quotations/:id/edit`
3. **Fix TransactionDrawer** to navigate to edit page for quotations (since there's no detail page)

---

## Implementation Details

### File 1: `src/pages/Quotations.tsx`

**Change 1 - View menu item (line 642-647):**

Replace the Link navigation with a button that opens the drawer:
```tsx
// Before:
<DropdownMenuItem asChild>
  <Link to={`/quotations/${q.id}`}>
    <Eye className="h-4 w-4 mr-2" />
    View
  </Link>
</DropdownMenuItem>

// After:
<DropdownMenuItem onClick={() => setDrawerQuotation(q)}>
  <Eye className="h-4 w-4 mr-2" />
  View
</DropdownMenuItem>
```

**Change 2 - Edit link (line 648-653):**

Fix the URL pattern to match the route defined in App.tsx:
```tsx
// Before:
<Link to={`/quotations/edit/${q.id}`}>

// After:
<Link to={`/quotations/${q.id}/edit`}>
```

### File 2: `src/components/TransactionDrawer.tsx`

**Change 3 - handleNavigate function (around line 343):**

For quotations, navigate to the edit page since there's no detail page:
```tsx
// Before:
else navigate(`/quotations/${transaction.id}`);

// After:
else navigate(`/quotations/${transaction.id}/edit`);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Quotations.tsx` | Fix View to open drawer, fix Edit URL pattern |
| `src/components/TransactionDrawer.tsx` | Fix quotation navigation to use edit route |

---

## Expected Behavior After Fix

| Action | Before | After |
|--------|--------|-------|
| Click "View" in dropdown | 404 error | Opens TransactionDrawer |
| Click "Edit" in dropdown | 404 error | Opens edit page correctly |
| Click quotation number | Opens drawer | Opens drawer (unchanged) |
| Click "View Full Details" in drawer | 404 error | Opens edit page |

---

## Testing Verification

1. Navigate to Quotations page
2. Click on quotation number - drawer should open
3. Click "View" in dropdown menu - drawer should open
4. Click "Edit" in dropdown menu - edit page should load
5. In drawer, click "View Full Details" - edit page should load
6. Verify converted quotations also work correctly
