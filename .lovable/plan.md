
# Dashboard Visual Consistency Refinement

## Overview
Apply consistent visual rules across all dashboard components to create a polished, unified appearance with proper spacing, subtle shadows, and consistent styling.

## Target Visual Rules

| Property | Value | Tailwind Class |
|----------|-------|----------------|
| Card padding | 16-20px | `p-4` to `p-5` |
| Border | Lighter/reduced opacity | `border-border/50` or custom CSS variable |
| Shadow | Very subtle | `shadow-[0_1px_3px_rgba(0,0,0,0.04)]` |
| Section spacing | 24px between major blocks | `gap-6` / `space-y-6` (already in place) |
| "View all" links | Consistent placement (top-right) and style | Standardized component |

## Current State Analysis

### Cards Using Different Padding
- `MetricCard`: Uses `p-5` - **Good**
- `RecentActivity`: Uses default `p-6` from CardContent - **Needs adjustment**
- `WorkQueueCard`: Uses `pb-2` header, default content - **Needs adjustment**
- `TodaySnapshotCard`: Uses `pb-3` header, default content - **Needs adjustment**
- `ReceivablesAgingCard`: Uses `pb-3` header, default content - **Needs adjustment**

### Border & Shadow Inconsistencies
- Base `Card` component uses `border` and `shadow-sm`
- Need to reduce both for a more subtle, refined look

### "View all" Link Variations
- `MetricCard`: Button with `ExternalLink` icon, positioned top-right
- `RecentActivity`: Link with `ArrowRight` icon, positioned in header right
- `WorkQueueCard`: Link with `ExternalLink` icon, positioned in header
- `ReceivablesAgingCard`: Button with `ArrowRight` icon, positioned in header right

## Implementation Plan

### 1. Update Base Card Component
**File:** `src/components/ui/card.tsx`

Update the Card base styles to use:
- Lighter border: `border-border/60`
- Subtler shadow: `shadow-[0_1px_2px_rgba(0,0,0,0.03)]`
- Keep `rounded-lg` for consistent corners

```tsx
// Updated Card className
"rounded-lg border border-border/60 bg-card text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
```

Also update CardHeader to use `p-5` instead of `p-6` and CardContent to use `p-5 pt-0`:

```tsx
// CardHeader: p-6 -> p-5
"flex flex-col space-y-1.5 p-5"

// CardContent: p-6 pt-0 -> p-5 pt-0
"p-5 pt-0"
```

### 2. Standardize "View All" Links
Create a consistent pattern using a Link/Button with the following style:
- Text: `text-xs text-muted-foreground hover:text-foreground`
- Icon: `ArrowRight` (3x3 size) with `ml-1`
- Position: Always in CardHeader, right-aligned

**Files to update:**
- `MetricCard.tsx` - Change `ExternalLink` to `ArrowRight` for consistency
- `WorkQueueCard.tsx` - Already uses `ExternalLink`, switch to `ArrowRight`
- `ReceivablesAgingCard.tsx` - Already correct
- `RecentActivity.tsx` - Already correct
- `TodaySnapshotCard.tsx` - Add "View all" link if appropriate

### 3. Adjust Individual Component Padding

**MetricCard.tsx:**
- Change from `p-5` to `p-4` for slightly tighter fit within fixed height
- Adjust internal spacing to compensate

**TodaySnapshotCard.tsx:**
- Add consistent CardHeader styling with proper spacing
- Use `pb-3` in header for tighter spacing

**RecentActivity.tsx:**
- Header already uses `pb-2` - keep as is
- Ensure content area uses proper padding

**WorkQueueCard.tsx:**
- Header already uses `pb-2` - keep as is
- Ensure internal list spacing is consistent

**ReceivablesAgingCard.tsx:**
- Header already uses `pb-3` - keep as is

### 4. Section Spacing Verification
Confirm all major layout gaps use `gap-6` (24px):
- KPI row grid: Currently `gap-4 lg:gap-6` - **Update to consistent `gap-6`**
- Desktop 12-column grid: Uses `gap-6` - **Correct**
- Mobile stacked sections: Uses `space-y-6` - **Correct**

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ui/card.tsx` | Update border opacity, shadow, and default padding |
| `src/components/MetricCard.tsx` | Adjust padding, change icon to ArrowRight |
| `src/components/TodaySnapshotCard.tsx` | Add View all link, adjust padding |
| `src/components/WorkQueueCard.tsx` | Change ExternalLink to ArrowRight |
| `src/pages/Index.tsx` | Update KPI grid gap to consistent `gap-6` |

## Visual Comparison

### Before
- Mixed padding (p-5, p-6)
- Standard border (`border`)
- Visible shadow (`shadow-sm`)
- Inconsistent "View all" icons

### After
- Consistent padding (p-4 to p-5)
- Lighter border (`border-border/60`)
- Subtle shadow (`shadow-[0_1px_2px_rgba(0,0,0,0.03)]`)
- Unified "View all" with ArrowRight icon
- Consistent 24px section spacing everywhere
