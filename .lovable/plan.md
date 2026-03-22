

## Invoice Template Designer — UX Fixes

### Issues Found

1. **Chevron doesn't rotate**: `data-[state=open]:rotate-180` is on the `ChevronDown` element, but `data-state` is set by Radix on the parent `CollapsibleTrigger`. The chevron never receives the attribute.

2. **Preview doesn't stick on scroll**: The right-side preview scrolls away when editing sidebar controls. Users must scroll back up to see changes.

3. **Layout Options has disconnected/unused controls**: `headerLayout`, `tableStyle`, `totalsStyle`, `bankingStyle`, and `layout` (default/cleanMinimal/compact) are all defined in the sidebar UI but **never used in `UnifiedInvoiceLayout` rendering logic**. They have zero visual effect. Only `bankingVisibility`, `vatSummaryVisibility`, `notesVisibility`, and `style` (modern/professional/minimalist) actually work.

4. **Page Margins control**: Exposed to users but comment in code says "margins exist in DB but are intentionally ignored (locked)". Dead control.

5. **"Show Invoice Notes" toggle**: Actually IS wired — `notesVisibility` is checked at line 1147 of `UnifiedInvoiceLayout`. It works correctly.

### Plan

**1. Fix chevron rotation** (`src/components/templates/TemplateControlSection.tsx`)
- Add `group` class to `CollapsibleTrigger`
- Change chevron to `group-data-[state=open]:rotate-180`

**2. Make preview sticky on scroll** (`src/pages/InvoiceTemplates.tsx`)
- Change the right `<main>` canvas to use `sticky top-0` positioning so the preview stays visible as the user scrolls the sidebar

**3. Clean up Layout Options section** (`src/pages/InvoiceTemplates.tsx`)
- Remove these disconnected controls that have no effect:
  - "Layout Style" (default/cleanMinimal/compact) — not rendered
  - "Header Layout" (default/centered/split) — not rendered
  - "Table Style" (default/striped/bordered/minimal) — not rendered
  - "Totals Style" (default/boxed/highlighted) — not rendered
  - "Banking Style" (default/boxed/minimal) — not rendered
  - "Page Margins" control — ignored in rendering
- Keep only the working toggles:
  - "Show Banking Details" (controls visibility)
  - "Show VAT Summary"
  - "Show Invoice Notes"
- Rename section from "Layout Options" to "Display Options" since it's just toggles now

**4. Template Selection dropdown overflow** (`src/pages/InvoiceTemplates.tsx`)
- Ensure the template management panel and dropdown fit within the 320px sidebar width

### Files to modify
- `src/components/templates/TemplateControlSection.tsx` — fix chevron rotation
- `src/pages/InvoiceTemplates.tsx` — sticky preview, remove dead controls, clean up Layout Options

