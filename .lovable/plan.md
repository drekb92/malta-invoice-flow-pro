
# Fix Invoice Hash Determinism

## Problem Analysis

The current `generateInvoiceHash()` function produces different hashes on each call due to:

1. **Timestamp inclusion** - `timestamp: new Date().toISOString()` changes every millisecond
2. **Unsorted items** - Invoice items are hashed in arbitrary database order
3. **Race condition in issueInvoice()** - Hash is computed before invoice_number is persisted, causing the stored hash to contain `null` for invoice_number while later verification reads the actual number

## Solution

### 1. Fix `generateInvoiceHash()` - Make it Deterministic

Remove timestamp and include only immutable financial fields:

```typescript
async generateInvoiceHash(
  invoiceId: string,
  overrideInvoiceNumber?: string  // Allow passing finalized number
): Promise<string> {
  // Fetch invoice and all items
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", invoiceId)
    .single();

  if (error) throw error;
  if (!invoice) throw new Error("Invoice not found");

  // Sort items deterministically by id (stable UUID order)
  const sortedItems = [...(invoice.invoice_items || [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      unit: item.unit,
    }));

  // Use override if provided (for issuance flow)
  const invoiceNumber = overrideInvoiceNumber ?? invoice.invoice_number;

  // Hash input with ONLY immutable financial fields - NO timestamp
  const hashInput = JSON.stringify({
    invoice_number: invoiceNumber,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date,
    customer_id: invoice.customer_id,
    // Discount fields
    discount_type: invoice.discount_type,
    discount_value: invoice.discount_value,
    // Totals
    amount: invoice.amount,
    vat_amount: invoice.vat_amount,
    vat_rate: invoice.vat_rate,
    total_amount: invoice.total_amount,
    // Sorted line items
    items: sortedItems,
  });

  // Generate SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
```

### 2. Fix `issueInvoice()` - Finalize Number Before Hashing

Update the sequence so invoice_number is saved first, then hash is computed with the correct value:

**Option A (Two Updates):**
```typescript
// Step 4: If no number, generate one
let finalInvoiceNumber = invoiceData.invoice_number;
if (!finalInvoiceNumber) {
  const { data: nextNumber } = await supabase.rpc("next_invoice_number", {...});
  finalInvoiceNumber = nextNumber;
  
  // Save invoice_number FIRST (before hashing)
  await supabase
    .from("invoices")
    .update({ invoice_number: finalInvoiceNumber })
    .eq("id", invoiceId);
}

// Step 5: Now generate hash (will read correct invoice_number)
const invoiceHash = await this.generateInvoiceHash(invoiceId);

// Step 6: Update remaining fields
await supabase
  .from("invoices")
  .update({
    is_issued: true,
    issued_at: new Date().toISOString(),
    invoice_hash: invoiceHash,
    status: "issued",
  })
  .eq("id", invoiceId);
```

**Option B (Pass Number to Hash Function):**
```typescript
// Generate hash with the finalized number passed directly
const invoiceHash = await this.generateInvoiceHash(invoiceId, finalInvoiceNumber);

// Single update with all fields
await supabase
  .from("invoices")
  .update({
    is_issued: true,
    issued_at: new Date().toISOString(),
    invoice_hash: invoiceHash,
    status: "issued",
    invoice_number: finalInvoiceNumber,
  })
  .eq("id", invoiceId);
```

I'll implement **Option B** as it's more efficient (single database update) and cleaner.

### 3. Update `verifyInvoiceIntegrity()` - No changes needed

Since hash is now deterministic and invoice_number is already saved, re-computing the hash will match.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/invoiceService.ts` | Fix `generateInvoiceHash()` and `issueInvoice()` |

---

## Changes Summary

| Function | Before | After |
|----------|--------|-------|
| `generateInvoiceHash()` | Includes `timestamp`, unsorted items | No timestamp, sorted by item.id, includes all financial fields |
| `generateInvoiceHash()` | Takes only `invoiceId` | Takes optional `overrideInvoiceNumber` parameter |
| `issueInvoice()` | Hashes before saving invoice_number | Passes finalized number to hash function |
| Hash input | 7 fields + timestamp | 11 fields (no timestamp) + sorted items with full data |

---

## Acceptance Criteria Verification

After implementation:

1. **Repeated `verifyInvoiceIntegrity()` returns `valid=true`** - Yes, because:
   - No timestamp in hash input
   - Items are sorted deterministically by UUID
   - Invoice number is passed explicitly during issuance

2. **Hash stays same unless data changes** - Yes, because:
   - All inputs are immutable invoice fields
   - Sorting is deterministic
   - No external time-dependent values
