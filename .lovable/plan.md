
# Work Queue Widget Refinement

## Overview
Refine the existing `WorkQueueCard` component to create a more compact, consistent layout across both tabs. The current implementation is functional but the "Follow-ups" tab has taller, multi-row cards while the "Needs Sending" tab is more compact. This plan unifies the row design and increases the item limit.

## Current State
- `WorkQueueCard.tsx` already exists with two tabs: "Follow-up Queue" and "Needs Sending"
- "Needs Sending" tab has compact single-row items
- "Follow-ups" tab has tall multi-row cards with channel selectors, last reminded info, and schedule dropdowns
- Both tabs limited to 5 items

## Target Layout

```text
+------------------------------------------------------------------+
| Work Queue                                        [View all →]   |
+------------------------------------------------------------------+
| [Follow-ups (3)]  [Needs Sending (5)]                            |
+------------------------------------------------------------------+
| INV-001  |  Customer A  |  €500.00  | [14d overdue] | [Remind]   |
| INV-002  |  Customer B  |  €250.00  | [7d overdue]  | [Remind]   |
| INV-003  |  Customer C  |  €125.00  | [3d overdue]  | [Remind]   |
| ... scrollable list up to 6 visible ...                          |
| ───────────────────────────────────────────────────────────────  |
|                    3 more need attention →                       |
+------------------------------------------------------------------+
```

Each row: `[Invoice #] [Customer] [Amount] [Status Pill] [Action Button]`

## Key Changes

### 1. Unify Row Height and Layout
Create a consistent single-row layout for both tabs:
- Fixed row height (~44px) for visual consistency
- Horizontal layout: Invoice number → Customer name → Amount → Status badge → Action button
- Remove multi-row content from follow-ups (channel chips, last reminded, schedule dropdown)
- Move advanced options (channel selection, scheduling) to a modal or inline dropdown on the action button

### 2. Increase Item Limit
- Change from 5 to 6 items per tab
- Maintain internal scrolling when content exceeds container height

### 3. Compact Row Design

**Follow-ups Tab Row:**
| Invoice # | Customer | Amount | `[Xd overdue]` badge | `[Send reminder]` button |

**Needs Sending Tab Row:**
| Invoice # | Customer | Amount | `[Draft]` or `[Not sent]` badge | `[Send]` button |

### 4. Simplified Action Buttons
- Follow-ups: Single "Remind" button (opens reminder dialog with channel/level options)
- Needs Sending: Single "Send" button (opens email dialog)

## Technical Implementation

### File: `src/components/WorkQueueCard.tsx`

**Changes:**
1. Create a shared `CompactInvoiceRow` sub-component for consistent styling
2. Update both tabs to use the compact row layout
3. Change item limits from 5 to 6
4. Remove inline channel chips and schedule dropdown from the main list
5. Add a reminder dialog trigger instead of inline "Send now"
6. Ensure proper overflow handling with `overflow-y-auto`

**Row Structure (both tabs):**
```tsx
<div className="flex items-center justify-between gap-2 py-2 px-3 rounded-md hover:bg-muted/50">
  {/* Left: Invoice info */}
  <div className="flex items-center gap-3 flex-1 min-w-0">
    <span className="font-medium text-sm truncate">{invoiceNumber}</span>
    <span className="text-xs text-muted-foreground truncate">{customerName}</span>
  </div>
  
  {/* Center: Amount */}
  <span className="text-sm font-medium tabular-nums shrink-0">{amount}</span>
  
  {/* Right: Status + Action */}
  <div className="flex items-center gap-2 shrink-0">
    <Badge>{status}</Badge>
    <Button size="sm">{action}</Button>
  </div>
</div>
```

### 5. Optional: Add SendReminderDialog Integration
For the "Remind" button, integrate with the existing `SendReminderDialog` component to allow users to:
- Select escalation level (Friendly, Firm, Final)
- Preview email before sending
- Choose channel if needed

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/WorkQueueCard.tsx` | Modify | Refactor to compact row layout, increase limit to 6 |

## Visual Consistency Checklist
- Row height: ~44px (py-2 + content)
- Typography: `text-sm` for invoice numbers and amounts, `text-xs` for customer names
- Badge sizing: `text-xs` with compact padding
- Button sizing: `size="sm"` with `h-7` height
- Spacing: `gap-2` between elements, consistent with dashboard cards
