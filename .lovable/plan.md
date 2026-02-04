
# Fix: Duplicate Invoice Numbers

## Problem Identified

The application has **two numbering systems** creating duplicates:

| System | Format | Example | Source |
|--------|--------|---------|--------|
| New RPC | `INV-YYYY-NNN` | `INV-2025-020` | `next_invoice_number` RPC function |
| Legacy Fallback | `INV-NNNNNN` | `INV-002026` | Fallback code in NewInvoice.tsx |

### How the Duplicate Happened

1. **Oct 2025**: Invoice `INV-002026` created using legacy fallback format
2. **Feb 2026**: When creating a new invoice, the RPC was called but the fallback code executed and generated `INV-002026` again by parsing the wrong format

### Root Cause

The `generateInvoiceNumber()` function in `NewInvoice.tsx`:
1. **Pre-generates numbers on page load** (lines 165-201) - consumes counter sequences even if invoice is never saved
2. Falls back to a legacy format that doesn't match the RPC format
3. The fallback regex `INV-(\d+)` incorrectly parses both formats

Additionally, there's **no unique constraint** on `invoice_number` column to prevent duplicates at the database level.

---

## Solution

### Phase 1: Immediate Data Fix

Delete or renumber the duplicate invoice to resolve the immediate conflict.

**Option A**: Delete the newer duplicate (if it's not needed)
```sql
DELETE FROM invoices WHERE id = 'eb51ce40-190f-48af-9e2e-05b7a93df0ec';
```

**Option B**: Renumber the newer invoice to the next available number
```sql
UPDATE invoices 
SET invoice_number = 'INV-2026-001' 
WHERE id = 'eb51ce40-190f-48af-9e2e-05b7a93df0ec';
```

---

### Phase 2: Prevent Future Duplicates

#### A. Add Unique Constraint on invoice_number

Create a partial unique index that prevents duplicates for non-null invoice numbers:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS unique_invoice_number_per_user 
ON invoices (user_id, invoice_number) 
WHERE invoice_number IS NOT NULL;
```

#### B. Remove Pre-generation of Invoice Numbers

**Problem**: `generateInvoiceNumber()` is called on component mount, which:
- Consumes counter sequences unnecessarily
- Can generate numbers that are never used (if user abandons the form)
- Creates race conditions when multiple tabs are open

**Solution**: Only generate invoice numbers at the moment of issuance/save, never for preview.

**File**: `src/pages/NewInvoice.tsx`

Remove or comment out the `generateInvoiceNumber()` function call on mount. Invoice numbers should only be generated when:
1. User clicks "Save & Issue" 
2. The invoice is being issued from draft state

Draft invoices should display "DRAFT" or be left blank until issued.

#### C. Remove Legacy Fallback Code

The fallback code creates inconsistent numbering. Remove it entirely and rely only on the RPC:

```tsx
// BEFORE: Has fallback that creates wrong format
const generateInvoiceNumber = async () => {
  try {
    const { data, error } = await callRpc('next_invoice_number', {...});
    if (error) throw error;
    if (data) setInvoiceNumber(data);
  } catch (error) {
    // REMOVE THIS FALLBACK - it creates wrong format
    try {
      // ... legacy fallback code
    } catch (...) {}
  }
};

// AFTER: No fallback, fail gracefully
const generateInvoiceNumber = async () => {
  try {
    const { data, error } = await callRpc('next_invoice_number', {...});
    if (error) throw error;
    if (data) setInvoiceNumber(data);
  } catch (error) {
    console.error("Error generating invoice number:", error);
    toast({
      title: "Error",
      description: "Failed to generate invoice number. Please try again.",
      variant: "destructive",
    });
  }
};
```

#### D. Initialize 2026 Counter

The counter table only has 2025. Ensure 2026 is properly initialized:

```sql
INSERT INTO invoice_counters (business_id, year, prefix, last_seq)
VALUES ('d28aef93-2cb5-44e8-96f5-5f9e5d911225', 2026, 'INV-', 1)
ON CONFLICT (business_id, year) DO NOTHING;
```

---

## Files to Modify

| File | Change |
|------|--------|
| Database Migration | Add unique index on `invoice_number` |
| `src/pages/NewInvoice.tsx` | Remove `generateInvoiceNumber()` on mount; remove legacy fallback |

---

## Summary of Changes

1. **Data fix**: Renumber or delete the duplicate `INV-002026`
2. **Unique constraint**: Prevent duplicates at database level  
3. **Remove pre-generation**: Only generate numbers when issuing
4. **Remove fallback**: Single source of truth for number generation
5. **Initialize 2026 counter**: Ensure new year has proper counter

---

## Expected Behavior After Fix

| Action | Before | After |
|--------|--------|-------|
| Open new invoice form | Number pre-generated, sequence consumed | Shows "Draft" or blank |
| Abandon form without saving | Number wasted | No sequence consumed |
| Save as draft | Number assigned immediately | Number stays blank |
| Issue invoice | Number already set | Number generated on issue |
| Try to save duplicate number | Saves successfully | Database rejects with error |
