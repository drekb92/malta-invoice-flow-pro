

## Fix: Scale Preview to Fit Viewport

### Problem
The invoice preview renders at full A4 size (~1123px tall at 794px wide) inside a sticky container. Since the content exceeds the viewport height, the bottom of the invoice is clipped and unreachable — the `sticky` positioning prevents scrolling the preview itself.

### Solution
Scale the entire preview down using CSS `transform: scale()` so the full invoice fits within the visible canvas area. This is a common pattern for document previews — show the whole page at a reduced zoom level.

**Approach:**
- Remove `sticky top-0` from the inner div (it causes the clipping problem)
- Instead, use `transform: scale()` with a calculated factor based on available height vs content height
- Use a `ref` on the preview container and calculate scale factor: `min(availableWidth / 794, availableHeight / contentHeight, 1)`
- Apply `transform-origin: top center` so it scales from the top
- Wrap in a container that sets its explicit height to the scaled height (so no overflow issues)

### Implementation

**File: `src/pages/InvoiceTemplates.tsx`**

1. Add a `ref` + `useState` for the canvas area dimensions using `ResizeObserver`
2. Calculate scale factor: `Math.min(containerWidth / previewWidth, containerHeight / estimatedA4Height, 1)` where `estimatedA4Height ≈ 1123px`
3. Apply `transform: scale(scaleFactor)` and `transform-origin: top center` to the preview wrapper
4. Set the outer container height to `scaledHeight` so layout works correctly
5. Remove the `sticky top-0` div wrapper — scaling solves the visibility problem

### Files to modify
- `src/pages/InvoiceTemplates.tsx` — add scale-to-fit logic for the right canvas preview

