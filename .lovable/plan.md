

# Fix Logo Sizing in Invoice PDF

The logo in invoices appears stretched/widened because the current CSS allows the image to scale freely within max-width/max-height bounds without preserving the original aspect ratio.

---

## Root Cause

| Issue | Current CSS | Problem |
|-------|-------------|---------|
| No aspect ratio preservation | `height: auto` only | Image can stretch to fill max-width |
| Missing object-fit | Not specified | No instruction to maintain proportions |
| Width not constrained | Only max-width set | Wide logos fill available space |

---

## Solution

Add `object-fit: contain` to the logo CSS to ensure the image scales proportionally within its container bounds, and set an explicit width constraint.

---

## Technical Implementation

### File: `src/components/UnifiedInvoiceLayout.tsx`

**Location:** Lines 348-354 (logo CSS class)

**Current code:**
```css
#${id} .logo {
  height: auto;
  max-height: ${variant === "preview" ? "60px" : "18mm"};
  max-width: ${variant === "preview" ? "200px" : "50mm"};
  display: block;
  margin-bottom: ${isPdf ? '2mm' : '8px'};
}
```

**Updated code:**
```css
#${id} .logo {
  width: auto;
  height: auto;
  max-height: ${variant === "preview" ? "60px" : "18mm"};
  max-width: ${variant === "preview" ? "160px" : "45mm"};
  object-fit: contain;
  object-position: left top;
  display: block;
  margin-bottom: ${isPdf ? '2mm' : '8px'};
}
```

---

## Changes Explained

| Property | Value | Purpose |
|----------|-------|---------|
| `width: auto` | auto | Let width be determined by aspect ratio |
| `object-fit: contain` | contain | Scale image to fit container while preserving aspect ratio |
| `object-position: left top` | left top | Align image to top-left corner |
| `max-width` reduced | 160px / 45mm | Slightly smaller max to prevent oversized logos |

---

## Visual Impact

**Before:**
- Logo stretched horizontally to fill available space
- Aspect ratio distorted
- Logo appears wider than intended

**After:**
- Logo maintains original aspect ratio
- Scales proportionally within max bounds
- Professional appearance matching original design

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/UnifiedInvoiceLayout.tsx` | Add `object-fit: contain` and adjust logo constraints |

