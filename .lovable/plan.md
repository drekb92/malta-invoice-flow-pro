

# Fix Template Not Saving Across Pages

## Problem

When you modify an invoice template in the Template Designer page (`/templates`) and then navigate to Invoices to download a PDF, the **old template** is still used. This happens because:

1. The `useInvoiceTemplate` hook stores template data in local React state
2. When you save a template, only the Template Designer page's local state is updated
3. When you navigate to Invoices, that page has its own separate copy of the template from when it first loaded
4. These two copies are never synchronized

## Solution

Convert the `useInvoiceTemplate` hook to use **TanStack React Query** (already installed). This provides:
- Automatic cache invalidation across all components using the same query key
- When you save a template in the Designer, invalidating the cache causes all other pages to refetch the fresh template
- No more stale data between pages

---

## Implementation Steps

### Step 1: Update `useInvoiceTemplate` Hook

Convert from local `useState` to React Query's `useQuery`:

```typescript
// src/hooks/useInvoiceTemplate.ts

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDefaultTemplate, InvoiceTemplate } from '@/services/templateService';
import { useToast } from '@/hooks/use-toast';

const TEMPLATE_QUERY_KEY = ['invoiceTemplate'];

export const useInvoiceTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: template, isLoading, error, refetch } = useQuery({
    queryKey: TEMPLATE_QUERY_KEY,
    queryFn: async () => {
      const loadedTemplate = await getDefaultTemplate();
      // Normalize template with defaults
      return {
        ...loadedTemplate,
        font_family: loadedTemplate.font_family || 'Inter',
        font_size: loadedTemplate.font_size || '14px',
        primary_color: loadedTemplate.primary_color || '#26A65B',
        accent_color: loadedTemplate.accent_color || '#1F2D3D',
        layout: loadedTemplate.layout || 'default',
        header_layout: loadedTemplate.header_layout || 'default',
        table_style: loadedTemplate.table_style || 'default',
        totals_style: loadedTemplate.totals_style || 'default',
        banking_visibility: loadedTemplate.banking_visibility ?? true,
        banking_style: loadedTemplate.banking_style || 'default',
        margin_top: loadedTemplate.margin_top ?? 20,
        margin_right: loadedTemplate.margin_right ?? 20,
        margin_bottom: loadedTemplate.margin_bottom ?? 20,
        margin_left: loadedTemplate.margin_left ?? 20,
      } as InvoiceTemplate;
    },
    staleTime: 0, // Always check for fresh data
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // This function invalidates the cache globally
  const refreshTemplate = async () => {
    await queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEY });
  };

  return {
    template: template ?? null,
    isLoading,
    error: error ? String(error) : null,
    refreshTemplate,
  };
};
```

### Step 2: Update Template Designer Save Handler

In `InvoiceTemplates.tsx`, ensure `refreshTemplate()` is called after saving (already done, but now it will actually invalidate globally):

```typescript
// Already in place at line 385:
await refreshTemplate();
```

No change needed here - the existing code will now work correctly because `refreshTemplate()` will invalidate the React Query cache.

---

## How It Works After The Fix

1. User opens Template Designer and modifies settings
2. User clicks "Save Template"
3. Template is saved to Supabase database
4. `refreshTemplate()` is called, which invalidates the `['invoiceTemplate']` query cache
5. User navigates to Invoices page
6. `useInvoiceTemplate()` sees the cache is invalid and refetches from database
7. PDF download uses the fresh template settings

---

## Files Changed

| Action | File |
|--------|------|
| MODIFY | `src/hooks/useInvoiceTemplate.ts` |

---

## Technical Notes

- The existing helper functions (`validateTemplateInvoiceData`, `normalizeInvoiceData`) at the bottom of the hook file will remain unchanged
- Error handling will use React Query's built-in error state
- The fallback template logic moves into the query function with proper error boundaries
- `staleTime: 0` ensures fresh data on every mount while still benefiting from cache invalidation

