# PDF Consistency Guide

## The Core Problem

When users design invoice templates, they expect the PDF they download to look **exactly** like the preview they see on screen. Any mismatch between preview and PDF creates confusion and frustration.

## The Solution: UnifiedInvoiceLayout

All invoice rendering (preview, PDF, print) now uses the **same React component**: `UnifiedInvoiceLayout.tsx`

### Key Principles

1. **Single Source of Truth**: One component renders all invoice views
2. **Consistent Data Flow**: Same props everywhere (companySettings, bankingSettings, templateSettings, invoiceData)
3. **No Divergence**: Preview HTML = PDF HTML = Print HTML
4. **WYSIWYG**: What You See Is What You Get

## How It Works

### Template Preview (InvoiceTemplates.tsx)
```tsx
<UnifiedInvoiceLayout
  id="invoice-preview-root"
  variant="pdf"
  invoiceData={sampleData}
  companySettings={companySettings}  // From useCompanySettings hook
  bankingSettings={bankingSettings}  // From useBankingSettings hook
  templateSettings={{
    primaryColor: template.primary_color,
    accentColor: template.accent_color,
    fontFamily: template.font_family,
    fontSize: template.font_size,
    layout: template.layout,
  }}
/>
```

### Invoice Creation (NewInvoice.tsx)
```tsx
<UnifiedInvoiceLayout
  id="invoice-preview-root"
  variant="pdf"
  invoiceData={actualInvoiceData}
  companySettings={companySettings}  // Same hook
  bankingSettings={bankingSettings}  // Same hook
  templateSettings={{
    primaryColor: template.primary_color,
    accentColor: template.accent_color,
    fontFamily: template.font_family,
    fontSize: template.font_size,
    layout: template.layout,
  }}
/>
```

### PDF Generation
```tsx
// Step 1: Capture the exact HTML from UnifiedInvoiceLayout
const root = document.getElementById('invoice-preview-root');
const cloned = root.cloneNode(true);

// Step 2: Inline images for reliability
await inlineImages(cloned);

// Step 3: Preserve CSS variables
const cssVars = getCSSVariables(root);

// Step 4: Send to edge function with full HTML
const html = buildFullHTML(cloned, cssVars);
await generatePDF(html);
```

## Data Hooks (Centralized Settings)

### useCompanySettings
- Loads company info from `company_settings` table
- Provides: name, address, email, phone, VAT, logo URL
- Validates data format
- Auto-creates defaults if missing

### useBankingSettings
- Loads banking details from `banking_details` table
- Provides: bank name, IBAN, SWIFT, account name
- Validates IBAN/SWIFT formats
- Handles display preferences

## Validation & Debugging

### PDF Consistency Validation
```typescript
import { validatePDFConsistency } from '@/lib/pdfConsistency';

const report = validatePDFConsistency(
  companySettings,
  bankingSettings,
  templateSettings,
  invoiceData
);

if (!report.isConsistent) {
  console.warn('PDF may not match preview:', report.errors);
}
```

### Debug Mode
```tsx
<UnifiedInvoiceLayout
  debug={true}  // Shows data source banner
  // ... other props
/>
```

Shows banner with:
- Company name (or "Missing")
- Banking details (or "Missing")
- Layout type
- Variant (preview/pdf/print)

## Common Issues & Solutions

### Issue: Colors Don't Match
**Cause**: Template colors not applied consistently
**Solution**: Always pass templateSettings with primaryColor and accentColor

### Issue: Logo Not Showing in PDF
**Cause**: Logo URL not absolute or CORS issues
**Solution**: Use `getCompanyLogoUrl()` helper which converts to absolute Supabase storage URL

### Issue: Banking Details Missing
**Cause**: Banking settings not loaded or `include_on_invoices = false`
**Solution**: Check `useBankingSettings()` hook and verify `include_on_invoices` flag

### Issue: Font Rendering Differently
**Cause**: Font not loaded in PDF HTML
**Solution**: Edge PDF function includes Google Fonts link with correct font family

### Issue: Template Changes Don't Reflect in Invoice
**Cause**: Template hook not refreshed after save
**Solution**: Call `refreshTemplate()` after template update

## Testing Checklist

When making changes, verify:

- [ ] Template preview matches downloaded PDF exactly
- [ ] Colors are identical (primary, accent, backgrounds)
- [ ] Fonts render the same way
- [ ] Logo appears in same position and size
- [ ] Banking details show consistently
- [ ] Spacing and margins are identical
- [ ] All text content matches
- [ ] VAT calculations are correct
- [ ] Discount displays properly
- [ ] Company information is complete

## File Reference

- `src/components/UnifiedInvoiceLayout.tsx` - Single invoice renderer
- `src/hooks/useCompanySettings.ts` - Company data hook
- `src/hooks/useBankingSettings.ts` - Banking data hook
- `src/lib/edgePdf.ts` - PDF generation via edge function
- `src/lib/pdfConsistency.ts` - Validation utilities
- `src/pages/InvoiceTemplates.tsx` - Template designer
- `src/pages/NewInvoice.tsx` - Invoice creation
- `src/pages/Invoices.tsx` - Invoice list & PDF download
- `supabase/functions/generate-invoice-pdf/` - PDF edge function

## Best Practices

1. **Always use UnifiedInvoiceLayout** - Never create custom invoice HTML
2. **Always load settings via hooks** - Never query database directly
3. **Always validate before PDF generation** - Use `validatePDFConsistency()`
4. **Always test with real data** - Sample data may hide issues
5. **Always check debug mode** - Verify all data is present

## Future Improvements

- [ ] Add side-by-side comparison mode (template vs invoice)
- [ ] Add PDF diff tool to highlight differences
- [ ] Add automated visual regression tests
- [ ] Add template validation before save
- [ ] Add real-time preview as you type
