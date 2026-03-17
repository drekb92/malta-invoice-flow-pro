

## Settings Audit & UX Cleanup

### Problems Found

**1. Disconnected settings — values saved but never used:**
- **Default payment terms**: `NewInvoice.tsx` line 493 hardcodes `"Net 30"` as fallback instead of reading `invoiceSettings.default_payment_days` or `companySettings.default_payment_terms`
- **Default VAT rate**: New line items hardcode `vat_rate: 0.18` in both `NewInvoice.tsx` (line 375) and `NewQuotation.tsx` (line 42) instead of reading `vat_rate_standard / 100` from invoice settings
- **Quotation valid-until**: `NewQuotation.tsx` line 35 hardcodes `addDays(new Date(), 30)` instead of using `default_payment_terms`
- **Include Payment Instructions** toggle: saved but never checked when rendering banking on invoices
- **Include VAT Breakdown** toggle: saved but never checked in `UnifiedInvoiceLayout`
- **Late Payment Interest Rate / Early Payment Discount**: saved but never shown on invoices
- **Invoice Language**: saved but not used (all text is English)
- **EU Cross-Border settings** (EORI, MOSS, Intrastat, distance selling thresholds): saved but have zero effect — these are informational/reference-only fields with no logic attached

**2. Duplicate settings:**
- "Default Payment Terms" appears in **both** Company tab and Invoice tab — confusing; they save to different tables (`company_settings.default_payment_terms` vs `invoice_settings.default_payment_days`)
- "Invoice Prefix" appears in Company tab's Business Settings — but the Invoice tab also has it. Two sources of truth.

**3. UX clutter:**
- Invoice tab has 5 large cards stacked: Numbering, Payment Terms, Document Content, Malta VAT Compliance, EU Cross-Border. That's overwhelming.
- EU Cross-Border card has niche fields (Intrastat threshold, MOSS eligibility) that 95% of users don't need
- Many helper texts are verbose

### Plan

**A. Wire up disconnected settings (functional fixes)**

1. **`src/pages/NewInvoice.tsx`**:
   - Use `invoiceSettings?.default_payment_days || companySettings?.default_payment_terms || 30` as fallback for due date when customer has no specific payment terms
   - Use `(invoiceSettings?.vat_rate_standard || 18) / 100` for new item default VAT rate instead of hardcoded `0.18`

2. **`src/pages/NewQuotation.tsx`**:
   - Import `useInvoiceSettings` hook
   - Use configured default payment days for "valid until" date fallback
   - Use configured VAT rate for new item default

3. **`src/components/UnifiedInvoiceLayout.tsx`**:
   - Add `includeVatBreakdown?: boolean` to `TemplateSettings`
   - When `includeVatBreakdown` is false, hide the per-rate VAT breakdown rows in the totals section (just show a single VAT total line)

4. **Pass `includePaymentInstructions` through** — when false, hide banking section on the invoice (in addition to the template's `bankingVisibility`)

**B. Remove duplicates from Company tab**

- Remove "Invoice Prefix" and "Quotation Prefix" from Company tab's Business Settings card (keep them in Invoice tab only where they belong)
- Remove "Default Payment Terms" from Company tab (keep in Invoice tab's Payment Terms card)
- Company tab Business Settings card becomes just "Default Currency"

**C. UX cleanup — Settings page restructure**

1. **Company tab**: Collapse into 2 cards only: "Company Information" (logo + details + address) and "Default Currency" (single field, small card)

2. **Invoice tab**: Reorganize into cleaner sections:
   - Collapse "Invoice Numbering" and "Payment Terms" into one card: **"Numbering & Terms"**
   - Keep "Document Content" card (footer, notes, quotation terms, payment instructions toggle)
   - Collapse "Malta VAT Compliance" and "EU Cross-Border" into one card: **"VAT & Compliance"** — use a collapsible/accordion for the advanced EU Cross-Border fields so they don't overwhelm

3. **General cleanup**:
   - Remove redundant helper text where the label is self-explanatory
   - Remove the disabled "Numbering System: Sequential" dropdown (it's always sequential, no need to show a disabled select)
   - Remove disabled "Zero VAT Rate" input (always 0, not useful)

### Files to modify

- `src/pages/NewInvoice.tsx` — use settings for default VAT rate and payment terms fallback
- `src/pages/NewQuotation.tsx` — import useInvoiceSettings, use default VAT rate and payment terms
- `src/components/UnifiedInvoiceLayout.tsx` — respect `includeVatBreakdown` setting
- `src/pages/Settings.tsx` — restructure tabs, remove duplicates, add collapsibles for advanced settings
- `src/hooks/useInvoiceTemplate.ts` — add `includeVatBreakdown` to normalized template (minor)

### No database changes needed

All settings columns already exist in the database.

