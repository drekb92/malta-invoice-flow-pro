

# Fix Minimalist Template Company/Customer Address Overlap

The minimalist template has overlapping company and customer details because the header height is constrained while Modern and Professional styles set `height: auto`.

---

## Root Cause Analysis

| Style | Header Height Setting | Result |
|-------|----------------------|--------|
| Modern | `height: auto` (line 604) | Expands with content ✓ |
| Professional | `height: auto` (line 658) | Expands with content ✓ |
| Minimalist | Uses base `height: 40mm` (line 343) | Fixed, causes overlap ✗ |

The minimalist style overrides many things (lines 704-795) but doesn't override the header height behavior, so when company details are longer than the fixed header height, they overlap with the Bill To section below.

---

## Solution

Add `height: auto` to the minimalist header CSS overrides to match the behavior of Modern and Professional styles. Also ensure proper bottom margin to separate the header from the Bill To section.

---

## Technical Implementation

### File: `src/components/UnifiedInvoiceLayout.tsx`

**Location:** Lines 712-716 (minimalist header overrides)

**Current code:**
```css
#${id} .header {
  background: transparent !important;
  padding-bottom: ${isPdf ? '8mm' : '32px'};
  border: none !important;
}
```

**Updated code:**
```css
#${id} .header {
  background: transparent !important;
  padding-bottom: ${isPdf ? '5mm' : '20px'};
  margin-bottom: ${isPdf ? '4mm' : '16px'};
  border: none !important;
  height: auto;
  min-height: ${isPdf ? '40mm' : '150px'};
}
```

---

## Changes Explained

| Property | Value | Purpose |
|----------|-------|---------|
| `height: auto` | auto | Allow header to expand with content |
| `min-height` | 40mm / 150px | Maintain minimum height for short content |
| `margin-bottom` | 4mm / 16px | Add spacing between header and Bill To section |
| `padding-bottom` | Reduced slightly | Balanced spacing with the new margin |

---

## Visual Impact

**Before:**
- Company details overlap with "Bill To" section
- Text layers on top of each other, unreadable

**After:**
- Header expands to fit all company information
- Clear separation between company info and customer details
- Matches the layout behavior of Modern and Professional styles

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/UnifiedInvoiceLayout.tsx` | Add `height: auto` and `margin-bottom` to minimalist header CSS |

