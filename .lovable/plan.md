
# Update "Converted" Label to "Converted to Invoice"

## Overview
Rename the quotation status label from "Converted" to "Converted to Invoice" across all display points. The internal status value (`converted`) stays the same -- only the user-facing label changes.

## Files to Update

### 1. `src/components/transaction-drawer/statusBadges.tsx` (line 33)
- Change `converted: "Converted"` to `converted: "Converted to Invoice"` in `STATUS_LABELS`

### 2. `src/components/transaction-drawer/utils.ts` (line ~54)
- Change `label: "Converted"` to `label: "Converted to Invoice"` in `getQuotationStatusBadge`

### 3. `src/pages/Quotations.tsx` (3 label changes)
- **Filter dropdown** (line ~601): Change `>Converted<` to `>Converted to Invoice<`
- **Convert button label** (line ~665): Change `"Convert"` text if present (keeping action button as-is since it's an action, not a status)
- **Toast message** (line ~505): Change `title: "Converted"` to `title: "Converted to Invoice"`

All internal status values (`"converted"`) and status comparisons remain unchanged -- only the displayed text updates.
