# Invoice Template Debugging Guide

This guide explains the debugging features added to validate template consistency across invoice generation.

## 🔍 Debugging Features Overview

### 1. **Console Logging in useInvoiceTemplate Hook**

The `useInvoiceTemplate` hook now logs detailed information about template loading:

```javascript
// Logs when template loading starts
[useInvoiceTemplate] Loading template...

// Logs the loaded template with all properties
[useInvoiceTemplate] Template loaded: { id, name, colors, fonts, layout... }

// Logs the normalized template after defaults are applied
[useInvoiceTemplate] Normalized template: { ... }

// Logs errors or warnings
[useInvoiceTemplate] Template missing required color fields, using defaults
[useInvoiceTemplate] Template loading error: ...
[useInvoiceTemplate] Using fallback template
```

**How to use:** Open browser DevTools → Console tab to see template loading sequence.

---

### 2. **Debug Prop in InvoiceHTML Components**

Both `InvoiceHTML` and `InvoiceHTMLEnhanced` components support a `debug` prop:

```tsx
<InvoiceHTML 
  debug={true}  // Enable debug mode
  invoiceData={...}
  template={...}
/>
```

**What it logs:**
```javascript
[InvoiceHTML] Rendering with: {
  template: { id, name, layout, hasLogo: true/false },
  layout: 'default' | 'cleanMinimal',
  variant: 'default' | 'template',
  invoiceNumber: 'INV-2024-001',
  customer: 'Customer Name'
}
```

**Visual debug info:** When enabled, a yellow banner appears at the top of the invoice showing:
- Template name
- Layout type
- Variant type

---

### 3. **PDF Generation Validation**

The `handleDownloadPDF` function in `Invoices.tsx` includes validation checks:

```javascript
[Invoices] Starting PDF download for invoice: {invoiceId}

// Validates template is loaded
[Invoices] Template not loaded, cannot generate PDF  // ERROR

// Logs template details being used
[Invoices] Using template: {
  id: 'template-uuid',
  name: 'Clean Minimal',
  layout: 'cleanMinimal',
  hasLogo: true
}

// Logs export progress
[Invoices] Setting export state for DOM rendering
[Invoices] Calling edge function for PDF generation
[Invoices] PDF generated successfully  // SUCCESS

// Logs errors
[Invoices] PDF download error: ...  // ERROR
```

---

### 4. **InvoiceErrorBoundary Component**

Error boundary wrapper catches rendering errors and displays helpful information:

**Location:** `src/components/InvoiceErrorBoundary.tsx`

**Usage:**
```tsx
<InvoiceErrorBoundary>
  <InvoiceHTML {...props} />
</InvoiceErrorBoundary>
```

**What it displays on error:**
- User-friendly error message
- Technical error details (expandable)
- Component stack trace
- Console logs for debugging

**Custom fallback:**
```tsx
<InvoiceErrorBoundary fallback={<CustomErrorUI />}>
  <InvoiceHTML {...props} />
</InvoiceErrorBoundary>
```

---

### 5. **Template Validation in InvoiceTemplates Page**

The InvoiceTemplates page validates template data before rendering:

**Features:**
- Validates required template fields (colors, fonts, etc.)
- Validates invoice data structure
- Shows validation errors in a red alert box
- Lists specific issues found

**Console output:**
```javascript
Invoice template validation failed: [
  'Template missing primary color',
  'Invoice missing customer name',
  'Invoice missing items'
]
```

---

## 🐛 How to Debug Template Issues

### Problem: Invoice PDF doesn't match template preview

**Steps:**
1. **Check console logs** for template loading:
   - Open DevTools → Console
   - Look for `[useInvoiceTemplate]` messages
   - Verify template ID and properties match expectations

2. **Enable debug mode** in NewInvoice.tsx:
   - Already enabled with `debug={true}`
   - Check yellow debug banner in invoice preview
   - Verify template name and layout match

3. **Inspect PDF generation**:
   - Look for `[Invoices]` logs in console
   - Verify template is loaded before PDF generation
   - Check for validation errors

4. **Check for errors**:
   - Look for red error boundaries
   - Check validation alerts in template designer
   - Review error details in console

---

### Problem: Template not loading

**Debug checklist:**
```javascript
// 1. Check if template hook is loaded
[useInvoiceTemplate] Loading template...  ✅
[useInvoiceTemplate] Template loaded: {...}  ✅

// 2. Verify template has required fields
template.primary_color  // Should exist
template.accent_color   // Should exist
template.font_family    // Should exist
template.layout         // Should be 'default' or 'cleanMinimal'

// 3. Check for fallback
[useInvoiceTemplate] Using fallback template  ⚠️  // Means error occurred
```

---

### Problem: Logo not appearing

**Debug steps:**
```javascript
// 1. Check template logo URL
[InvoiceHTML] Rendering with: {
  template: { hasLogo: true }  // Should be true
}

// 2. Check console for logo loading errors
GET https://...supabase.co/storage/v1/object/public/logos/...  404  ❌

// 3. Verify logo URL format
// Correct: 'filename.png' or 'https://...'
// Incorrect: '/logos/filename.png'
```

---

### Problem: Colors not applying

**Debug steps:**
```javascript
// 1. Check normalized template colors
[useInvoiceTemplate] Normalized template: {
  primary_color: '#26A65B',  // Should be hex color
  accent_color: '#1F2D3D'    // Should be hex color
}

// 2. Verify colors in debug banner
Template: Clean Minimal | primary: #26A65B  ✅

// 3. Check CSS variables in invoice HTML
// Open DevTools → Elements → #invoice-preview-root
// Verify CSS variables are set correctly
```

---

## 📊 Testing Checklist

Use this checklist to verify template consistency:

### Template Designer
- [ ] Template saves successfully
- [ ] Preview updates immediately
- [ ] No validation errors shown
- [ ] Logo appears in preview
- [ ] Colors apply correctly
- [ ] Bank details show (if configured)

### New Invoice Page
- [ ] Debug banner shows correct template
- [ ] Invoice preview renders
- [ ] No error boundaries triggered
- [ ] Console shows template loaded
- [ ] Template matches designer preview

### Invoices List Page
- [ ] PDF download completes
- [ ] No template validation errors
- [ ] Console shows template details
- [ ] Downloaded PDF matches template
- [ ] Logo appears in PDF
- [ ] Colors match template

### Console Logs Check
```javascript
// Expected log sequence for successful PDF generation:
1. [useInvoiceTemplate] Loading template...
2. [useInvoiceTemplate] Template loaded: {...}
3. [useInvoiceTemplate] Normalized template: {...}
4. [InvoiceHTML] Rendering with: {...}
5. [Invoices] Starting PDF download for invoice: ...
6. [Invoices] Using template: {...}
7. [Invoices] Setting export state for DOM rendering
8. [Invoices] Calling edge function for PDF generation
9. [Invoices] PDF generated successfully
```

---

## 🔧 Troubleshooting Common Issues

### Issue: Multiple templates in database

**Symptom:** Different invoices use different templates randomly

**Fix:** Run database migration to ensure only one default template:
```sql
UPDATE invoice_templates SET is_default = false;
UPDATE invoice_templates SET is_default = true 
WHERE name = 'Your Preferred Template';
```

### Issue: Template not refreshing after save

**Symptom:** Changes in template designer don't appear in invoices

**Fix:** The hook should auto-refresh after save. Check console:
```javascript
[useInvoiceTemplate] Loading template...  // Should appear after save
```

If not appearing, the `refreshTemplate()` call may be missing in save handler.

### Issue: PDF generation fails silently

**Symptom:** No error message, PDF doesn't download

**Debug:**
1. Check console for `[Invoices]` logs
2. Look for error messages in edge function logs
3. Verify DOM element exists: `document.getElementById('invoice-preview-root')`
4. Check network tab for API call failures

---

## 🎯 Quick Debug Commands

Run these in browser console for quick debugging:

```javascript
// Check if template hook is loaded
window.localStorage.getItem('supabase.auth.token')

// Force template reload (requires page context)
// This would be called from the component using the hook

// Check DOM element exists
document.getElementById('invoice-preview-root')

// Check CSS variables applied
getComputedStyle(document.getElementById('invoice-preview-root'))
  .getPropertyValue('--color-primary')

// Verify template in local state (requires React DevTools)
// Use React DevTools → Components → Search "useInvoiceTemplate"
```

---

## 📝 Notes

- **Debug mode is enabled by default** in NewInvoice.tsx for easier debugging
- **Remove `debug={true}`** in production for cleaner output
- **Console logs are prefixed** with component/function names for easy filtering
- **Error boundaries catch React errors** but not network/API errors
- **Template validation** runs on every render in template designer

---

## 🚀 Performance Considerations

Debug mode adds minimal overhead:
- Console.log statements: ~0.1ms each
- Validation checks: ~1ms per invoice
- Error boundaries: No overhead unless error occurs

For production, consider:
1. Remove `debug={true}` props
2. Reduce console.log frequency
3. Keep error boundaries (they're essential)
