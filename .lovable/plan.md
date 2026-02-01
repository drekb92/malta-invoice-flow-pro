

# Fix Template Style Persistence Across Invoice Generation

This plan addresses why the saved template style is not being used when generating invoices, and ensures the style persists correctly throughout the application.

---

## Root Causes Identified

| Issue | Location | Problem |
|-------|----------|---------|
| Duplicate defaults in database | `invoice_templates` table | Two templates marked as `is_default: true` |
| Missing style in Invoices page | `src/pages/Invoices.tsx` line 743-758 | `templateSettings` doesn't include `style` property |
| Wrong style source in NewInvoice | `src/pages/NewInvoice.tsx` line 1367 | Uses local `selectedStyle` state (always 'modern') instead of template's style |
| Unused local state | `src/pages/NewInvoice.tsx` line 131 | `selectedStyle` state is set but never synced with template |

---

## Solution Overview

1. **Invoices.tsx**: Add missing `style` property to templateSettings
2. **NewInvoice.tsx**: Use template's style directly instead of local state, or sync local state with loaded template
3. **Template page**: Ensure style selector reflects the current template's style (already works correctly)

---

## Technical Implementation

### 1. Invoices.tsx - Add Missing Style Property

**Location:** Lines 743-758

Add `style: template?.style || 'modern'` to the templateSettings object:

```typescript
templateSettings={{
  primaryColor: template.primary_color,
  accentColor: template.accent_color,
  fontFamily: template.font_family,
  fontSize: template.font_size,
  layout: template?.layout || "default",
  headerLayout: template?.header_layout || "default",
  tableStyle: template?.table_style || "default",
  totalsStyle: template?.totals_style || "default",
  bankingVisibility: template?.banking_visibility !== false,
  bankingStyle: template?.banking_style || "default",
  style: template?.style || 'modern',  // ADD THIS LINE
  marginTop: template?.margin_top || 20,
  marginRight: template?.margin_right || 20,
  marginBottom: template?.margin_bottom || 20,
  marginLeft: template?.margin_left || 20,
}}
```

### 2. NewInvoice.tsx - Use Template Style Instead of Local State

**Option A (Recommended):** Remove the unused `selectedStyle` state and use template style directly

**Location:** Line 131 - Remove or update the local state:
```typescript
// Remove this line, or sync it with template
// const [selectedStyle, setSelectedStyle] = useState<TemplateStyle>('modern');
```

**Location:** Line 1367 - Change from local state to template style:
```typescript
// BEFORE:
style: selectedStyle,

// AFTER:
style: templateForPreview?.style || 'modern',
```

**Option B (Alternative):** Sync local state with template when it loads

Add a `useEffect` to sync `selectedStyle` when the template loads:
```typescript
useEffect(() => {
  if (templateForPreview?.style) {
    setSelectedStyle(templateForPreview.style);
  }
}, [templateForPreview?.style]);
```

I recommend **Option A** since `selectedStyle` is never used elsewhere - it's set but only referenced on line 1367.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Invoices.tsx` | Add `style` to templateSettings (line ~758) |
| `src/pages/NewInvoice.tsx` | Use `templateForPreview?.style` instead of `selectedStyle` (line 1367) |

---

## Data Flow After Fix

```text
User saves template with style "Professional"
    ↓
Database stores: style = 'professional'
    ↓
useInvoiceTemplate() hook loads template with style
    ↓
NewInvoice.tsx uses templateForPreview.style → 'professional'
Invoices.tsx uses template.style → 'professional'
    ↓
UnifiedInvoiceLayout renders with correct style
    ↓
PDF generation captures correct styling
```

---

## Testing Steps

After implementation:
1. Go to Template Designer, select "Professional" style, save
2. Create a new invoice - preview should show Professional style
3. Go to Invoices list, download PDF - should match Professional style
4. Change template to "Minimalist", save
5. Download an invoice PDF again - should now be Minimalist

