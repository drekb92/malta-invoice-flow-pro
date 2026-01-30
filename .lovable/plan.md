
# Remove Unused / Legacy PDF & Credit Note Services

## Summary

This cleanup will remove 5 deprecated service files and extract the one shared TypeScript interface to a dedicated types file. All PDF exports will continue working via the production Edge HTML engine (`edgePdf.ts` + Unified layouts).

## Analysis Results

| File | Status | Reason |
|------|--------|--------|
| `src/services/edgePdfExportAction.ts` | DELETE | No imports found - completely unused |
| `src/services/creditNotesService.ts` | DELETE | No imports - credit notes handled by `invoiceService.ts` |
| `src/services/statementPdfService.ts` | DELETE | No imports - statements use `UnifiedStatementLayout` |
| `src/services/pdfService.ts` | DELETE | Only used for type import - extract `InvoiceData` first |
| `src/lib/pdfGenerator.ts` | DELETE | No imports - legacy jsPDF wrapper unused |
| `jspdf` in package.json | REMOVE | No longer needed after file deletions |
| `html2canvas` in package.json | KEEP | May be used elsewhere - needs verification |

## Type Extraction

The `InvoiceData` interface is currently imported by 2 components:
- `src/components/InvoiceSettlementSheet.tsx`
- `src/components/TransactionDrawer.tsx`

This interface will be extracted to a new file:

```
src/types/pdf.ts
```

---

## Implementation Steps

### Step 1: Create `src/types/pdf.ts`

Extract the `InvoiceData` interface from `pdfService.ts`:

```typescript
export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  documentType?: "INVOICE" | "CREDIT NOTE" | "QUOTATION";
  customer: {
    name: string;
    email?: string;
    address?: string;
    address_line1?: string;
    address_line2?: string;
    locality?: string;
    post_code?: string;
    vat_number?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    unit?: string;
  }>;
  totals: {
    netTotal: number;
    vatTotal: number;
    grandTotal: number;
  };
}
```

### Step 2: Update Imports in Components

Update the 2 components to import from the new types file:

**InvoiceSettlementSheet.tsx:**
```typescript
// Before
import type { InvoiceData } from "@/services/pdfService";

// After
import type { InvoiceData } from "@/types/pdf";
```

**TransactionDrawer.tsx:**
```typescript
// Before
import type { InvoiceData } from "@/services/pdfService";

// After
import type { InvoiceData } from "@/types/pdf";
```

### Step 3: Delete Unused Service Files

Delete these 5 files:
1. `src/services/edgePdfExportAction.ts`
2. `src/services/creditNotesService.ts`
3. `src/services/statementPdfService.ts`
4. `src/services/pdfService.ts`
5. `src/lib/pdfGenerator.ts`

### Step 4: Remove jsPDF from Dependencies

Update `package.json` to remove the jspdf dependency:

```json
// Remove this line:
"jspdf": "^3.0.1",
```

---

## Verification Checklist

After implementation:
- [ ] Project builds successfully (`npm run build`)
- [ ] No broken imports in any component
- [ ] PDF download works for Invoices via Edge HTML engine
- [ ] PDF download works for Statements via Edge HTML engine
- [ ] PDF download works for Quotations via Edge HTML engine
- [ ] Credit note creation still works (via `invoiceService.createCreditNote`)

---

## Files Changed

| Action | File |
|--------|------|
| CREATE | `src/types/pdf.ts` |
| MODIFY | `src/components/InvoiceSettlementSheet.tsx` |
| MODIFY | `src/components/TransactionDrawer.tsx` |
| DELETE | `src/services/edgePdfExportAction.ts` |
| DELETE | `src/services/creditNotesService.ts` |
| DELETE | `src/services/statementPdfService.ts` |
| DELETE | `src/services/pdfService.ts` |
| DELETE | `src/lib/pdfGenerator.ts` |
| MODIFY | `package.json` (remove jspdf) |
