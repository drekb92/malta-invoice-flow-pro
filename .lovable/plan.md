
# Fix: Dashboard Email Send - Missing Invoice Preview

## Problem Summary
When sending an invoice email from the Dashboard's "Needs Sending" widget, the system fails with error: "Preview root not found (invoice-preview-root)."

This happens because:
- The `SendDocumentEmailDialog` relies on finding a hidden `<UnifiedInvoiceLayout id="invoice-preview-root">` element in the DOM
- The Invoice Details page includes this hidden element, so sending works there
- The Dashboard page does NOT include this element, causing the failure

## Solution Overview
Modify the send dialog to dynamically render the invoice preview when no existing preview root is found. This involves:
1. Fetching invoice data when the dialog opens
2. Rendering a hidden `UnifiedInvoiceLayout` within the dialog itself
3. Using that rendered preview to generate the PDF

## Implementation Plan

### Step 1: Create a Hook to Fetch Invoice Data for PDF
Create a new hook that fetches all the data needed to render an invoice for PDF generation.

**New File:** `src/hooks/useInvoicePdfData.ts`
- Fetch invoice, items, totals, customer, company settings, banking settings, and template
- Return the complete data structure needed by `UnifiedInvoiceLayout`
- Include loading and error states

### Step 2: Update SendDocumentEmailDialog
**File:** `src/components/SendDocumentEmailDialog.tsx`

Changes:
1. Add optional `previewAvailable?: boolean` prop (defaults to checking DOM for existing preview)
2. When no preview is available, use the new hook to fetch invoice data
3. Render a hidden `UnifiedInvoiceLayout` inside the dialog with the fetched data
4. Wait for the layout to render before enabling the send button
5. Use the dynamically rendered preview for PDF generation

```tsx
interface SendDocumentEmailDialogProps {
  // ... existing props
  /** Set to true if an invoice-preview-root element already exists in the DOM */
  previewAvailable?: boolean;
}
```

### Step 3: Modify handleSend Logic
Update the `handleSend` function to:
1. Check if `invoice-preview-root` exists in DOM
2. If not, wait for the internal preview to render (via a ref)
3. Use whichever preview is available for PDF generation

### Step 4: Update WorkQueueCard
**File:** `src/components/WorkQueueCard.tsx`

Changes:
1. Pass `previewAvailable={false}` to `SendDocumentEmailDialog` since the dashboard doesn't have a preview
2. No other changes needed - the dialog will handle data fetching internally

## Technical Implementation Details

### New Hook: useInvoicePdfData
```tsx
export function useInvoicePdfData(invoiceId: string | null, enabled: boolean) {
  // Fetch invoice with customer
  // Fetch invoice items
  // Fetch invoice totals
  // Use existing hooks for: template, company settings, banking settings
  
  // Return formatted data matching UnifiedInvoiceLayout's invoiceData prop
  return {
    data: invoiceData | null,
    isLoading: boolean,
    isReady: boolean, // All data loaded
    error: Error | null
  };
}
```

### Dialog Internal Preview Rendering
```tsx
{/* Hidden preview for PDF generation when no external preview exists */}
{!previewAvailable && invoicePdfData && (
  <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
    <UnifiedInvoiceLayout
      id="invoice-preview-root"
      variant="pdf"
      invoiceData={invoicePdfData}
      // ... other required props
    />
  </div>
)}
```

### Updated handleSend Flow
```tsx
const handleSend = async () => {
  // Validate email...
  
  // Wait for preview to be available
  await waitForPreviewRoot(); // Small polling/timeout function
  
  // Generate PDF using prepareHtmlForPdf()
  const html = await prepareHtmlForPdf(...);
  
  // Send email via edge function...
};
```

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useInvoicePdfData.ts` | Create | New hook to fetch all invoice data for PDF rendering |
| `src/components/SendDocumentEmailDialog.tsx` | Modify | Add dynamic preview rendering when no external preview exists |
| `src/components/WorkQueueCard.tsx` | Modify | Pass `previewAvailable={false}` to the dialog |

## Edge Cases Handled

1. **Existing preview available**: Uses existing DOM element (no change in behavior)
2. **No preview, dialog just opened**: Shows loading state while fetching data
3. **Invoice not found**: Shows error toast and prevents send
4. **Slow data loading**: Disables send button until ready
5. **User closes dialog before data loads**: Cleanup handled by React unmount

## Testing Checklist
- Send invoice from Dashboard "Needs Sending" tab (should now work)
- Send invoice from Invoice Details page (should still work as before)
- Send quotation, credit note, statement from their respective pages (no regression)
- Error handling when invoice data fails to load
- Loading state displays correctly while data is being fetched
