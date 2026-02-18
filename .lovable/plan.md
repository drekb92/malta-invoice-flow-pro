
# Add "Convert & Send" Button to Quotation Detail

## Overview

The Quotation list page (`src/pages/Quotations.tsx`) handles both the list view and the quotation detail drawer. A new "Convert & Send" button needs to be added that:

1. Converts the quotation to an invoice (same logic as "Convert to Invoice")
2. Issues the invoice immediately (sets `is_issued = true`, `status = "sent"`)
3. Automatically sends the invoice email to the customer
4. Redirects to the new invoice page

## Visibility Rules

Both buttons ("Convert to Invoice" and "Convert & Send") appear only when:
- `q.status === "accepted"` (not just `q.status !== "converted"` — today the button shows for all non-converted statuses)
- `q.status !== "converted"` (not already converted)

The new button requires **accepted** status. The existing "Convert to Invoice" button keeps its current visibility rule (`!== "converted"`).

## Changes Required

### `src/pages/Quotations.tsx`

**1. Add new state variables:**
```tsx
const [isConvertingAndSending, setIsConvertingAndSending] = useState(false);
const [convertAndSendDialogOpen, setConvertAndSendDialogOpen] = useState(false);
const [convertAndSendQuotation, setConvertAndSendQuotation] = useState<Quotation | null>(null);
const [convertAndSendDateOption, setConvertAndSendDateOption] = useState<"quotation" | "today" | "custom">("today");
const [convertAndSendCustomDate, setConvertAndSendCustomDate] = useState<Date | undefined>(undefined);
```

**2. Add new import:** `Send` from `lucide-react`

**3. Add `handleConvertAndSend` function:**

This function reuses the existing quotation-to-invoice conversion logic with two key differences:
- Sets `status: "sent"` and calls `invoiceService.issueInvoice(inv.id)` to also set `is_issued = true`
- After conversion, renders the invoice PDF in the hidden container (using the new invoice's data) and sends the email automatically via `supabase.functions.invoke("send-document-email", ...)`
- Shows a success toast and redirects to `/invoices/${inv.id}`

```tsx
const handleConvertAndSend = async (quotationId: string, invoiceDateOverride?: Date) => {
  // 1. Convert quotation → invoice (same as existing, but status: "sent")
  // 2. Issue the invoice (is_issued = true, issued_at, invoice_hash)
  // 3. Fetch invoice items to build PDF data
  // 4. Render hidden UnifiedInvoiceLayout for the NEW invoice
  // 5. Capture HTML and send via send-document-email edge function
  // 6. Mark quotation as converted
  // 7. Show success toast
  // 8. navigate(`/invoices/${inv.id}`)
};
```

**4. Add "Convert & Send" button to the table action column (line ~665):**

```tsx
{q.status === "accepted" && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => openConvertAndSendDialog(q)}
  >
    <Send className="h-4 w-4 mr-2" />
    Convert &amp; Send
  </Button>
)}
```

Place it alongside the existing "Convert to Invoice" button. Only show for `status === "accepted"`.

**5. Also add "Convert & Send" to the dropdown menu** for the same condition.

**6. Add a new confirmation dialog** (similar to the existing convert dialog) for "Convert & Send" with its own date picker and a loading state that shows "Converting & Sending..." during the async operation.

**7. Add a new hidden invoice PDF container** for the newly created invoice (separate from the existing quotation PDF container) to avoid conflicts during the send flow.

## Flow Summary

```text
User clicks "Convert & Send"
  → Dialog opens (pick invoice date)
  → User clicks "Convert & Send" button in dialog
    → Create invoice (status: "sent", is_issued: true)
    → Fetch invoice items
    → Build InvoiceData for the new invoice
    → Set pdfInvoiceData state (renders hidden UnifiedInvoiceLayout with id="invoice-send-root")
    → Wait 200ms for DOM render
    → Capture HTML from "invoice-send-root"
    → Call send-document-email edge function with captured HTML
    → Mark quotation as converted
    → Show success toast: "Invoice sent to {email}"
    → navigate(`/invoices/${inv.id}`)
```

## Key Technical Notes

- The invoice is created with `status: "sent"` and `is_issued: true`, `issued_at: now()`, `invoice_hash` generated — matching what `invoiceService.issueInvoice()` does — but done in a single combined step to avoid the two-step race condition.
- The hidden PDF render uses a **different element ID** (`invoice-send-root`) to avoid colliding with the existing `invoice-preview-root` used by quotation emails/downloads.
- The `send-document-email` edge function is called directly (not via the dialog component) since this is a fully automated flow with no user confirmation of email fields needed.
- If the customer has no email address, the function shows an error toast before proceeding.
- The `invoiceService.generateInvoiceHash()` is imported and called with the new invoice ID and number to produce the integrity hash before issuing.
