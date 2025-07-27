-- Add missing RLS policies for invoice_totals table
-- This table currently has NO RLS policies which is a critical security issue

-- Enable RLS on invoice_totals if not already enabled
ALTER TABLE public.invoice_totals ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for invoice_totals table
-- Users can only view invoice totals for their own invoices
CREATE POLICY "Users can view own invoice totals" 
ON public.invoice_totals 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_totals.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

-- Users can insert invoice totals for their own invoices
CREATE POLICY "Users can insert own invoice totals" 
ON public.invoice_totals 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_totals.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

-- Users can update invoice totals for their own invoices
CREATE POLICY "Users can update own invoice totals" 
ON public.invoice_totals 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_totals.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

-- Users can delete invoice totals for their own invoices
CREATE POLICY "Users can delete own invoice totals" 
ON public.invoice_totals 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_totals.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

-- Add missing INSERT and DELETE policies for profiles table
-- Currently only has SELECT and UPDATE policies

-- Users can insert their own profile (needed for new user registration)
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);