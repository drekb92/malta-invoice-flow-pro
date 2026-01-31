

# Persist Template Style Across the App

This plan ensures the `style` property (modern/professional/minimalist) is properly saved to and loaded from the database, and persists across all template operations.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/pages/InvoiceTemplates.tsx` | Map `style` when loading templates, include in save, set in createDefaultTemplate |
| `src/components/templates/TemplateManagementPanel.tsx` | Include `style` in create, duplicate, and import operations |
| `src/hooks/useInvoiceTemplate.ts` | Add `style` to normalization with default "modern" |
| `src/services/templateService.ts` | Use `data.style` from DB instead of always forcing "modern" |

---

## Technical Implementation

### 1. InvoiceTemplates.tsx - Loading Templates

**Location:** Lines 213-229 (loadTemplates function)

Add `style` to the template mapping with a default of "modern":

```typescript
const typedData: InvoiceTemplate[] = data.map((t) => ({
  ...t,
  // ... existing mappings
  vat_summary_visibility: (t as any).vat_summary_visibility ?? false,
  style: (t as any).style || 'modern',  // ADD THIS LINE
  margin_top: t.margin_top || 20,
  // ...
}));
```

### 2. InvoiceTemplates.tsx - Saving Templates

**Location:** Lines 360-377 (handleSave function)

Add `style` to the update payload:

```typescript
const { error } = await supabase
  .from("invoice_templates")
  .update({
    // ... existing fields
    margin_left: currentSettings.margin_left,
    style: currentSettings.style,  // ADD THIS LINE
  })
  .eq("id", currentSettings.id);
```

### 3. InvoiceTemplates.tsx - Creating Default Template

**Location:** Lines 256-274 (createDefaultTemplate function)

Add `style: 'modern'` to the default template:

```typescript
const defaultTemplate = {
  // ... existing fields
  margin_left: 20,
  style: 'modern',  // ADD THIS LINE
  user_id: user.id,
};
```

### 4. TemplateManagementPanel.tsx - Creating New Templates

**Location:** Lines 86-106 (handleCreateTemplate)

Add `style: 'modern'` to the insert payload:

```typescript
.insert([{
  // ... existing fields
  margin_left: 20,
  style: 'modern',  // ADD THIS LINE
  user_id: userId,
}])
```

### 5. TemplateManagementPanel.tsx - Duplicating Templates

**Location:** Lines 136-156 (handleDuplicateTemplate)

Add `style` to the duplicated template:

```typescript
.insert([{
  // ... existing fields
  margin_left: currentSettings.margin_left || selectedTemplate.margin_left,
  style: currentSettings.style || selectedTemplate.style || 'modern',  // ADD THIS LINE
  user_id: userId,
}])
```

### 6. TemplateManagementPanel.tsx - Importing Templates

**Location:** Lines 250-271 (handleImportTemplate)

Add `style` to the imported template:

```typescript
.insert([{
  // ... existing fields
  margin_left: importedData.margin_left || 20,
  style: importedData.style || 'modern',  // ADD THIS LINE
  user_id: userId,
}])
```

### 7. useInvoiceTemplate.ts - Normalization

**Location:** Lines 33-50 (queryFn normalization)

Add `style` to the normalized template:

```typescript
const normalizedTemplate = {
  ...loadedTemplate,
  // ... existing normalizations
  vat_summary_visibility: loadedTemplate.vat_summary_visibility ?? false,
  style: loadedTemplate.style || 'modern',  // ADD THIS LINE
  margin_top: loadedTemplate.margin_top ?? 20,
  // ...
} as InvoiceTemplate;
```

### 8. templateService.ts - Loading from DB

**Location:** Lines 107-130 (getDefaultTemplate function)

Use `data.style` from the database instead of always forcing 'modern':

```typescript
const template: InvoiceTemplate = {
  ...data,
  // ... existing mappings
  banking_position: ((data as any).banking_position || 'after-totals') as 'after-totals' | 'bottom' | 'footer',
  style: data.style || 'modern',  // CHANGE: Use DB value with fallback
  margin_top: data.margin_top || 20,
  // ...
};
```

Also update the return statement at the bottom to preserve the style:

```typescript
// Only apply style overrides if explicitly requested via parameter
return style ? applyStyleToTemplate(template, style) : template;
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/InvoiceTemplates.tsx` | 3 changes: loadTemplates, handleSave, createDefaultTemplate |
| `src/components/templates/TemplateManagementPanel.tsx` | 3 changes: create, duplicate, import |
| `src/hooks/useInvoiceTemplate.ts` | 1 change: normalization |
| `src/services/templateService.ts` | 1 change: DB loading |

---

## Flow After Implementation

1. User selects "Professional" style in Template Designer
2. User clicks "Save" - `style: 'professional'` is saved to `invoice_templates` table
3. User navigates to Invoices page
4. `useInvoiceTemplate` hook loads template from DB with `style: 'professional'`
5. PDF generation uses the correct "professional" style

