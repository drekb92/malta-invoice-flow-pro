
# Remove "TAX INVOICE" Label from Documents

## Summary

Remove the "TAX INVOICE" label that appears above the document title on invoices, credit notes, and quotations. The document type heading (INVOICE, CREDIT NOTE, QUOTATION) already clearly identifies the document.

---

## Current State

The header currently displays:
```
TAX INVOICE     <-- Remove this
INVOICE         <-- Keep this (document type)
No: INV-2026-002
Date: 04 Feb 2026
Due: 04 Mar 2026
```

## After Change

The header will display:
```
INVOICE
No: INV-2026-002
Date: 04 Feb 2026
Due: 04 Mar 2026
```

---

## Implementation

### File: `src/components/UnifiedInvoiceLayout.tsx`

**Change 1 - Remove the HTML element (line 891):**
```tsx
// Remove this line:
<div className="tax-invoice-label">TAX INVOICE</div>
```

**Change 2 - Remove the base CSS styles (lines 460-468):**
```css
/* Remove this entire block: */
/* Tax Invoice Label */
#${id} .tax-invoice-label {
  font-size: ${fontSize.tiny};
  font-weight: 700;
  color: #6b7280;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: ${isPdf ? '1mm' : '4px'};
}
```

**Change 3 - Remove from header color override (lines 614-618):**
```css
// Remove the tax-invoice-label reference from this rule
```

**Change 4 - Remove Elegant template override (lines 678-680):**
```css
/* Remove this block: */
#${id} .tax-invoice-label {
  color: #6b7280;
}
```

**Change 5 - Remove Modern template override (lines 738-740):**
```css
/* Remove this block: */
#${id} .tax-invoice-label {
  color: #9ca3af;
}
```

---

## Impact

| Document Type | Before | After |
|--------------|--------|-------|
| Invoice | Shows "TAX INVOICE" + "INVOICE" | Shows only "INVOICE" |
| Credit Note | Shows "TAX INVOICE" + "CREDIT NOTE" | Shows only "CREDIT NOTE" |
| Quotation | Shows "TAX INVOICE" + "QUOTATION" | Shows only "QUOTATION" |

---

## Testing

1. Navigate to Invoice Templates page
2. Preview an invoice - verify "TAX INVOICE" label is gone
3. Preview a credit note - verify "TAX INVOICE" label is gone  
4. Preview a quotation - verify "TAX INVOICE" label is gone
5. Download a PDF - verify the label is removed in the PDF output
