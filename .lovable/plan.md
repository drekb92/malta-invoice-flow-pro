

## Consistency Audit: Download PDF vs Email PDF

### Discrepancies Found

I compared the three places where `UnifiedInvoiceLayout` is rendered for PDF generation:

1. **`Invoices.tsx`** (list page download) — most complete, passes all template settings
2. **`InvoiceDetails.tsx`** (detail page download + email source) — **missing 7 template fields and `footerText`**
3. **`useInvoicePdfData.ts`** (email fallback when no preview DOM) — **missing `includeVatBreakdown` and `includePaymentInstructions`**

### Specific Missing Fields

**`InvoiceDetails.tsx` hidden layout** is missing from `templateSettings`:
- `headerLayout` (controls header arrangement)
- `tableStyle` (controls table borders/styling)
- `totalsStyle` (controls totals section layout)
- `bankingStyle` (controls banking section look)
- `notesVisibility` (toggle notes on/off)
- `style` (modern/professional/minimalist — the most impactful one)
- `marginTop/Right/Bottom/Left`

Also missing the `footerText` prop entirely — so footer text from Settings never appears on PDFs downloaded from the invoice detail page.

**`useInvoicePdfData.ts`** templateSettings is missing:
- `includeVatBreakdown`
- `includePaymentInstructions`

### Impact
- An invoice downloaded from the **detail page** may look different from one downloaded from the **list page** (wrong style, missing footer, wrong table style)
- An invoice sent by **email from Dashboard** (fallback path) won't respect the VAT breakdown or payment instructions toggles

### Plan

**1. Fix `InvoiceDetails.tsx`** — Add the 7 missing template fields and `footerText` prop to match `Invoices.tsx`

**2. Fix `useInvoicePdfData.ts`** — Fetch `invoice_settings` (already fetched for footer text) and add `includeVatBreakdown` and `includePaymentInstructions` to the template settings object

### Files to modify
- `src/pages/InvoiceDetails.tsx` — add missing templateSettings fields and footerText
- `src/hooks/useInvoicePdfData.ts` — add includeVatBreakdown and includePaymentInstructions

No database changes needed.

