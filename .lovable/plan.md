

## Default Invoice Notes & Payment Terms Auto-Population

### Current State
- Settings already has **"Default Invoice Footer Text"** (`invoice_footer_text`) and **"Default Invoice Notes"** (`default_invoice_notes`) fields that save to `invoice_settings`
- The footer text is already passed to `UnifiedInvoiceLayout` as `footerText` and rendered in the PDF
- However, **`default_invoice_notes` is saved but never used** — it's not auto-populated on new invoices and not rendered anywhere
- There is no per-invoice notes field on the NewInvoice form
- The template has no toggle for notes visibility

### Plan

**1. Add per-invoice notes field to NewInvoice form** (`src/pages/NewInvoice.tsx`)
- Add a `notes` state variable, auto-populated from `invoiceSettings?.default_invoice_notes` on mount (only for new invoices, not edit mode)
- Add a "Notes" textarea in the sidebar or below the items table, editable per-invoice
- Pass the notes to `UnifiedInvoiceLayout` as a new `notesText` prop

**2. Add `notesText` prop to UnifiedInvoiceLayout** (`src/components/UnifiedInvoiceLayout.tsx`)
- Add `notesText?: string` to the props interface
- Render notes above the footer in a "Notes" section with small muted text styling (similar to terms section)
- Only render if `notesText` is non-empty

**3. Add notes visibility toggle to template** 
- Add `notes_visibility` boolean to `InvoiceTemplate` interface (`src/services/templateService.ts`)
- Add column to `invoice_templates` table (migration, default `true`)
- Add toggle in Template Designer (`src/pages/InvoiceTemplates.tsx`)
- Pass through to `UnifiedInvoiceLayout` via `templateSettings` and conditionally render notes

**4. Improve Settings labels** (`src/pages/Settings.tsx`)
- Rename "Default Invoice Notes" to add a description: "Auto-populates on every new invoice. Editable per invoice."
- Add placeholder text like `"Payment due within 30 days. Late payments subject to interest per EU Directive."`

**5. Persist notes with invoice** 
- The `invoices` table doesn't have a `notes` column — need a migration to add `notes text` column
- Save/load notes when creating/editing invoices
- Show notes in InvoiceDetails page and pass to PDF generation

### Database Changes
1. `ALTER TABLE invoices ADD COLUMN notes text;` — per-invoice notes
2. `ALTER TABLE invoice_templates ADD COLUMN notes_visibility boolean DEFAULT true;` — template toggle

### Files to Modify
- `src/pages/NewInvoice.tsx` — add notes state, auto-populate, textarea, pass to layout
- `src/components/UnifiedInvoiceLayout.tsx` — add `notesText` prop, render notes section
- `src/services/templateService.ts` — add `notes_visibility` to interface
- `src/pages/InvoiceTemplates.tsx` — add notes visibility toggle
- `src/pages/Settings.tsx` — improve labels/placeholders
- `src/pages/InvoiceDetails.tsx` — pass notes to layout
- `src/pages/Invoices.tsx` — pass notes to hidden PDF layout
- `src/hooks/useInvoicePdfData.ts` — include notes in PDF data
- `src/hooks/useInvoiceTemplate.ts` — normalize `notes_visibility`

