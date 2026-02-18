
# Consolidate "Convert & Send" into the Existing Convert Dialog

## Problem
The "Convert & Send" button currently lives as a separate button in the table row (only visible for `accepted` quotations), making it hard to find. The user wants a cleaner approach: keep only the "Convert to Invoice" button in the table row, and add a second "Convert & Send" action button **inside the existing dialog** so both options are presented together when the user clicks "Convert to Invoice".

## Target UX (based on screenshot reference)
The existing "Convert quotation to invoice" dialog already has:
- Date selection radio group (Quotation date / Today's date / Custom)
- Cancel button
- Convert button

**After the change**, the dialog footer will have:
- Cancel button
- **Convert & Send** button (outline/secondary style)
- **Convert** button (primary, existing behaviour)

This matches the pattern the user described: one dialog, two actions.

## Changes to `src/pages/Quotations.tsx`

### 1. Remove "Convert & Send" from table row buttons (line ~875-880)
Delete the separate "Convert & Send" button that only shows for `accepted` status:
```tsx
// REMOVE THIS:
{q.status === "accepted" && (
  <Button size="sm" variant="outline" onClick={() => openConvertAndSendDialog(q)}>
    <Send className="h-4 w-4 mr-2" />
    Convert & Send
  </Button>
)}
```

### 2. Remove "Convert & Send" from the dropdown menu
Search for and remove the corresponding dropdown menu item for Convert & Send.

### 3. Add "Convert & Send" button into the existing Convert dialog footer
Update the `DialogFooter` of the existing convert dialog (around line 1010-1017) to include a second button:
```tsx
<DialogFooter>
  <Button variant="outline" onClick={() => setConvertDialogOpen(false)} disabled={isConverting || isConvertingAndSending}>
    Cancel
  </Button>
  <Button 
    variant="outline" 
    onClick={handleConvertAndSendFromDialog} 
    disabled={isConverting || isConvertingAndSending}
  >
    {isConvertingAndSending ? (
      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Converting & Sending...</>
    ) : (
      <><Send className="h-4 w-4 mr-2" />Convert & Send</>
    )}
  </Button>
  <Button onClick={confirmConvert} disabled={isConverting || isConvertingAndSending}>
    {isConverting ? "Converting..." : "Convert"}
  </Button>
</DialogFooter>
```

### 4. Add `handleConvertAndSendFromDialog` function
This is a thin adapter that reads the **same date state** (`dateOption`, `customDate`) already set in the convert dialog, then calls `handleConvertAndSend` — reusing the existing logic without any duplication:
```tsx
const handleConvertAndSendFromDialog = async () => {
  if (!selectedQuotation) return;
  if (dateOption === "custom" && !customDate) {
    toast({ title: "Select a date", description: "Please choose a valid custom date.", variant: "destructive" });
    return;
  }
  setIsConvertingAndSending(true);
  try {
    const override =
      dateOption === "today"
        ? new Date()
        : dateOption === "custom"
        ? customDate
        : undefined;
    await handleConvertAndSend(selectedQuotation.id, override);
    setConvertDialogOpen(false);
    setSelectedQuotation(null);
  } finally {
    setIsConvertingAndSending(false);
  }
};
```

### 5. Remove the separate "Convert & Send" Dialog entirely
Delete the entire second `<Dialog>` block (lines ~1021-1110) for Convert & Send — it is no longer needed.

### 6. Clean up unused state variables
Remove the four `convertAndSend*` state variables that were only used by the now-removed separate dialog:
- `convertAndSendDialogOpen`
- `convertAndSendQuotation`
- `convertAndSendDateOption`
- `convertAndSendCustomDate`

Also remove `openConvertAndSendDialog` helper function if present.

## Result
- One "Convert to Invoice" button per row (always shown when not yet converted)
- Clicking it opens the existing dialog with date picker
- Dialog has two action buttons: **Convert & Send** (sends email automatically) and **Convert** (creates draft invoice only)
- Clean, discoverable UX matching the user's intent
