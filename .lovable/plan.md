

# Invoice Template Updates

This plan addresses several layout and formatting improvements to the invoice template.

---

## Summary of Changes

| Change | Description |
|--------|-------------|
| Remove Ship To | Delete the "Ship To" address block, keep only "Bill To" |
| Fix VAT Display | Format VAT rates as percentages (18% not 0.18) |
| Remove VAT Summary Box | Hide the VAT Summary section by default, add optional toggle |
| Reorganize Header | Logo on left, supplier details below. Document info on right |
| Fix Customer Section | Bill To on left, Invoice Date/Due Date on right |

---

## Technical Implementation

### 1. Remove Ship To Section

**File:** `src/components/UnifiedInvoiceLayout.tsx`

**Current:** Two-column grid with "Bill To" and "Ship To" (lines 897-935)
```
<div className="address-grid">
  <div className="address-block billto">...</div>
  <div className="address-block shipto">...</div>
</div>
```

**Change:** Remove the Ship To block entirely, change grid to single column or reuse for invoice metadata.

---

### 2. Fix VAT Rate Display in Line Items

**File:** `src/components/UnifiedInvoiceLayout.tsx`

**Issue:** The local `percent` function (line 111) outputs `0.18%` when given decimal rates like `0.18`.

**Current code:**
```typescript
const percent = (val: number) => `${Number(val || 0)}%`;
```

**Fix:** Normalize VAT rates before display (multiply by 100 if less than 1):
```typescript
const percent = (val: number) => {
  const normalized = Number(val || 0);
  const displayRate = normalized > 1 ? normalized : normalized * 100;
  return `${Math.round(displayRate)}%`;
};
```

This ensures both `0.18` and `18` inputs display as `18%`.

---

### 3. Remove VAT Summary Box (with optional toggle)

**File:** `src/components/UnifiedInvoiceLayout.tsx`

**Current:** VAT Summary section is always displayed (lines 1005-1075)

**Change:** 
- Add `vatSummaryVisibility` to `TemplateSettings` interface
- Default to `false` (hidden)
- Only render VAT Summary when explicitly enabled

**File:** `src/services/templateService.ts`

**Add to InvoiceTemplate interface:**
```typescript
vat_summary_visibility?: boolean;
```

**File:** `src/pages/InvoiceTemplates.tsx`

**Add toggle in settings panel** (similar to banking_visibility toggle)

---

### 4. Reorganize Header Layout

**File:** `src/components/UnifiedInvoiceLayout.tsx`

**Current Layout:**
- Left: Logo + Company details
- Right: Document title + Invoice number, Date, Due date

**Target Layout:**
- Left: Logo + Company/supplier details (same as current)
- Right: Document meta box with Invoice No, Date, Due Date

This is already the current layout, but we need to ensure proper alignment.

---

### 5. Bill To Left / Invoice Dates Right

**File:** `src/components/UnifiedInvoiceLayout.tsx`

**Change the address grid section (lines 897-935):**

Replace the "Bill To / Ship To" grid with:
- **Left column:** Bill To (customer info)
- **Right column:** Invoice metadata (Date, Due Date, No.) - moved from header

This creates a cleaner layout:
```
[Logo]                    [TAX INVOICE]
[Company Details]         [INVOICE #XXX]

[Bill To]                 [Date: XX/XX/XXXX]
[Customer Name]           [Due: XX/XX/XXXX]
[Customer Address]
[Customer VAT]
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/UnifiedInvoiceLayout.tsx` | Remove Ship To, fix percent function, conditionally hide VAT Summary, adjust layout |
| `src/services/templateService.ts` | Add `vat_summary_visibility` to InvoiceTemplate interface |
| `src/pages/InvoiceTemplates.tsx` | Add VAT Summary visibility toggle in settings |
| `src/hooks/useInvoiceTemplate.ts` | Add default for `vat_summary_visibility` |

---

## Visual Before/After

**Before:**
```text
┌─────────────────────────────────────────────────┐
│ [Logo]              TAX INVOICE                 │
│ Company Name        INVOICE                     │
│ Address             No: INV-001                 │
│ Email               Date: 15/01/2026            │
│ VAT: MT12345        Due: 30/01/2026             │
├─────────────────────────────────────────────────┤
│ Bill To          │  Ship To                     │
│ Customer Name    │  Customer Name               │
│ Address          │  Address                     │
├─────────────────────────────────────────────────┤
│ Description  Qty  Price  VAT   Total            │
│ Service A     1   €100   0.18  €100             │  <- VAT shows 0.18
├─────────────────────────────────────────────────┤
│ VAT Summary Box (always shown)                  │
└─────────────────────────────────────────────────┘
```

**After:**
```text
┌─────────────────────────────────────────────────┐
│ [Logo]              TAX INVOICE                 │
│ Company Name        INVOICE                     │
│ Address             No: INV-001                 │
│ Email               Date: 15/01/2026            │
│ VAT: MT12345        Due: 30/01/2026             │
├─────────────────────────────────────────────────┤
│ Bill To                                         │
│ Customer Name                                   │
│ Address                                         │
│ [VAT: MT67890]                                  │
├─────────────────────────────────────────────────┤
│ Description  Qty  Price  VAT   Total            │
│ Service A     1   €100   18%   €100             │  <- VAT shows 18%
├─────────────────────────────────────────────────┤
│ (No VAT Summary - hidden by default)            │
└─────────────────────────────────────────────────┘
```

---

## Database Consideration

The `vat_summary_visibility` field may need to be added to the `invoice_templates` table. If the column doesn't exist, it will be handled gracefully with a default value of `false` in the TypeScript code.

