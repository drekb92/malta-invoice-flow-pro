

# Fix: Quotation to Invoice Conversion - Duplicate Number Error

## Problem Summary

When converting quotation QUO-000008 to an invoice, the system fails with:
```
duplicate key value violates unique constraint "unique_invoice_number_per_user"
```

## Root Cause Analysis

The `Quotations.tsx` file contains a **legacy** `generateNextInvoiceNumber` function that:

1. Fetches the most recent invoice (`INV-2026-001`)
2. Uses regex `/INV-(\d+)/` to extract a number
3. This incorrectly extracts "2026" from the year portion
4. Adds 1 and generates `INV-002027`
5. But `INV-002027` already exists in the database!

Meanwhile, the rest of the app uses the `next_invoice_number` RPC which properly generates sequential numbers like `INV-2026-002`.

| File | Current Approach | Correct Approach |
|------|------------------|------------------|
| `NewInvoice.tsx` | Uses `next_invoice_number` RPC | Correct |
| `invoiceService.ts` | Uses `next_invoice_number` RPC | Correct |
| `Quotations.tsx` | Uses **legacy regex parsing** | **Needs fix** |

---

## Solution

Replace the legacy `generateNextInvoiceNumber` function in `Quotations.tsx` with a call to the `next_invoice_number` RPC, matching the pattern used elsewhere.

---

## Implementation Plan

### File: `src/pages/Quotations.tsx`

**Change 1 - Replace `generateNextInvoiceNumber` function (lines 384-405):**

Remove the legacy function:
```typescript
// REMOVE THIS
const generateNextInvoiceNumber = async () => {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("invoice_number")
      .order("created_at", { ascending: false })
      .limit(1);
    // ... regex parsing logic
  }
};
```

Replace with RPC call:
```typescript
// REPLACE WITH
const generateNextInvoiceNumber = async (): Promise<string> => {
  const { data, error } = await supabase.rpc("next_invoice_number", {
    p_business_id: user!.id,
    p_prefix: "INV-",
  });
  
  if (error) throw error;
  if (!data) throw new Error("Failed to generate invoice number");
  
  return data;
};
```

This ensures:
- Proper `INV-YYYY-NNN` format
- Atomically incremented sequence via the database
- No collisions with existing numbers
- Consistency with the rest of the application

---

## Testing Verification

After implementation:
1. Navigate to Quotations page
2. Select QUO-000008
3. Click "Convert to Invoice"
4. Should successfully create invoice with number like `INV-2026-002`
5. Verify invoice appears in invoice list

---

## Technical Notes

- The `next_invoice_number` RPC uses an atomic counter table (`invoice_counters`) 
- It generates year-based sequences: `INV-{YEAR}-{SEQ}`
- The current 2026 counter is at `last_seq = 1`, so next will be `INV-2026-002`
- No database changes required - only frontend code fix

