

# Unified Template Styling for All Documents

This plan ensures Credit Notes and Statements use the same template style (Modern/Professional/Minimalist) as Invoices.

---

## Current Problem

| Document | Template Style Applied? | Issue |
|----------|------------------------|-------|
| Invoice | Yes (`style: template?.style`) | Works correctly |
| Credit Note | No | Missing `style` property in templateSettings |
| Statement | No | UnifiedStatementLayout doesn't support `style` property |

---

## Solution Overview

1. **CreditNotes.tsx**: Add the missing `style` property and `footerText` prop
2. **UnifiedStatementLayout.tsx**: Add `style` property support to the TemplateSettings interface and implement the three visual styles
3. **StatementModal.tsx**: Pass the full template settings including `style`

---

## Technical Implementation

### Step 1: Fix CreditNotes.tsx

**File:** `src/pages/CreditNotes.tsx`

**Change 1:** Add import for `useInvoiceSettings`
```typescript
import { useInvoiceSettings } from "@/hooks/useInvoiceSettings";
```

**Change 2:** Add hook usage after other hooks (around line 59)
```typescript
const { settings: invoiceSettings } = useInvoiceSettings();
```

**Change 3:** Add `style` property to templateSettings (line 532-546)
```typescript
templateSettings={template ? {
  primaryColor: template.primary_color,
  accentColor: template.accent_color,
  fontFamily: template.font_family,
  fontSize: template.font_size,
  layout: template.layout as any,
  headerLayout: template.header_layout as any,
  tableStyle: template.table_style as any,
  totalsStyle: template.totals_style as any,
  bankingVisibility: template.banking_visibility,
  bankingStyle: template.banking_style as any,
  marginTop: template.margin_top,
  marginRight: template.margin_right,
  marginBottom: template.margin_bottom,
  marginLeft: template.margin_left,
  style: template.style || 'modern',  // ADD THIS
} : undefined}
```

**Change 4:** Add `footerText` prop to UnifiedInvoiceLayout
```typescript
footerText={invoiceSettings?.invoice_footer_text}
```

---

### Step 2: Update UnifiedStatementLayout

**File:** `src/components/UnifiedStatementLayout.tsx`

**Change 1:** Add `style` to TemplateSettings interface (lines 29-39)
```typescript
export interface TemplateSettings {
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSize?: string;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  bankingVisibility?: boolean;
  style?: 'modern' | 'professional' | 'minimalist';  // ADD THIS
}
```

**Change 2:** Add style-based header rendering logic

Extract the `style` prop in the component function:
```typescript
const style = templateSettings?.style || 'modern';
```

Apply conditional styling to the header section based on `style`:
- **Modern**: Solid color header background with white/contrasting text
- **Professional**: White header with colored top border
- **Minimalist**: Plain white header, no border, primary color only on title

---

### Step 3: Update StatementModal.tsx

**File:** `src/components/StatementModal.tsx`

**Change:** Pass `style` in templateSettings (lines 646-650)
```typescript
templateSettings={{
  primaryColor: template?.primary_color || '#26A65B',
  accentColor: template?.accent_color || '#1F2D3D',
  fontFamily: template?.font_family || 'Inter',
  style: template?.style || 'modern',  // ADD THIS
}}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CreditNotes.tsx` | Add `style` to templateSettings, import useInvoiceSettings, add footerText prop |
| `src/components/UnifiedStatementLayout.tsx` | Add `style` to TemplateSettings interface, implement style-based header rendering |
| `src/components/StatementModal.tsx` | Pass `style` property to UnifiedStatementLayout |

---

## Visual Result

After implementation:
- Credit Note PDFs will match the selected template style (Modern/Professional/Minimalist)
- Statement PDFs will also use the selected template style
- All documents will have consistent branding across the application
- Credit Notes will include the custom footer text from Document Content settings

