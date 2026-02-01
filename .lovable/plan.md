

# Fix Invoice Footer Text from Settings

The footer text in invoices is hardcoded as "Thank you for your business. All amounts in EUR." even though the Settings page allows users to customize it. This plan connects the saved `invoice_footer_text` from the database to the invoice layout.

---

## Root Cause

| Component | Current Behavior | Problem |
|-----------|-----------------|---------|
| Settings page | Saves footer to `invoice_settings.invoice_footer_text` | Works correctly |
| UnifiedInvoiceLayout | Hardcoded footer on lines 1100-1104 | Ignores saved setting |
| Invoices.tsx / NewInvoice.tsx | Don't load invoice_settings | No data to pass |

The footer text is saved to the database but never retrieved or passed to the invoice layout component.

---

## Solution Overview

1. Create a new `useInvoiceSettings` hook to load invoice settings from the database
2. Add `footerText` prop to `UnifiedInvoiceLayout` interface
3. Update the footer rendering to use the dynamic text
4. Pass the footer text from both `Invoices.tsx` and `NewInvoice.tsx`

---

## Technical Implementation

### Step 1: Create useInvoiceSettings Hook

**New file:** `src/hooks/useInvoiceSettings.ts`

Create a hook similar to `useBankingSettings` that loads from `invoice_settings` table:

```typescript
export interface InvoiceSettings {
  id: string;
  user_id: string;
  invoice_footer_text?: string;
  default_invoice_notes?: string;
  reverse_charge_note?: string;
  default_payment_days?: number;
  // ... other fields as needed
}

export const useInvoiceSettings = (): UseInvoiceSettingsReturn => {
  // Load from supabase invoice_settings table
  // Return settings, isLoading, error, refresh
};
```

### Step 2: Update UnifiedInvoiceLayout Props

**File:** `src/components/UnifiedInvoiceLayout.tsx`

Add `footerText` to the props interface:

```typescript
export interface UnifiedInvoiceLayoutProps {
  invoiceData: InvoiceData;
  companySettings?: CompanySettings;
  bankingSettings?: BankingSettings;
  templateSettings?: TemplateSettings;
  variant?: "preview" | "pdf";
  id?: string;
  documentType?: DocumentType;
  debug?: boolean;
  footerText?: string;  // NEW: Custom footer text from settings
}
```

### Step 3: Update Footer Rendering

**File:** `src/components/UnifiedInvoiceLayout.tsx` (lines 1100-1104)

Change from hardcoded text to using the prop with a fallback:

```typescript
// BEFORE (hardcoded):
<div className="thanks">
  Thank you for your business
  <br />
  All amounts in EUR.
</div>

// AFTER (dynamic with fallback):
<div className="thanks">
  {footerText || "Thank you for your business. All amounts in EUR."}
</div>
```

### Step 4: Update Invoices.tsx

**File:** `src/pages/Invoices.tsx`

1. Import and use the new hook:
```typescript
import { useInvoiceSettings } from "@/hooks/useInvoiceSettings";

const { settings: invoiceSettings } = useInvoiceSettings();
```

2. Pass footer text to UnifiedInvoiceLayout:
```typescript
<UnifiedInvoiceLayout
  // ... existing props
  footerText={invoiceSettings?.invoice_footer_text}
/>
```

### Step 5: Update NewInvoice.tsx

**File:** `src/pages/NewInvoice.tsx`

Same pattern as Invoices.tsx - import the hook and pass the footer text.

---

## Files to Create/Modify

| File | Action | Change |
|------|--------|--------|
| `src/hooks/useInvoiceSettings.ts` | Create | New hook to load invoice settings |
| `src/components/UnifiedInvoiceLayout.tsx` | Modify | Add `footerText` prop, update footer rendering |
| `src/pages/Invoices.tsx` | Modify | Load invoice settings, pass footer text |
| `src/pages/NewInvoice.tsx` | Modify | Load invoice settings, pass footer text |

---

## Data Flow After Fix

```text
User edits footer in Settings → Document Content tab
    ↓
Saved to invoice_settings.invoice_footer_text
    ↓
useInvoiceSettings hook loads settings
    ↓
Invoices.tsx / NewInvoice.tsx pass footerText prop
    ↓
UnifiedInvoiceLayout renders custom footer
    ↓
PDF export includes custom footer text
```

---

## Testing Steps

After implementation:
1. Go to Settings → Document Content tab
2. Update the Invoice Footer field (e.g., "Thank you! Payment due within 14 days.")
3. Save the settings
4. Create a new invoice - preview should show the custom footer
5. Download a PDF from the Invoices list - should show the same custom footer
6. Test with empty footer - should fall back to default text

