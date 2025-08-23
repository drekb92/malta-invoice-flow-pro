-- Enable Row Level Security on invoice_totals table
ALTER TABLE public.invoice_totals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invoice_totals table
-- Users can only view invoice totals for their own invoices
CREATE POLICY "Users can view own invoice totals" 
ON public.invoice_totals 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.invoices 
  WHERE invoices.id = invoice_totals.invoice_id 
  AND invoices.user_id = auth.uid()
));

-- Users can insert invoice totals for their own invoices
CREATE POLICY "Users can insert own invoice totals" 
ON public.invoice_totals 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.invoices 
  WHERE invoices.id = invoice_totals.invoice_id 
  AND invoices.user_id = auth.uid()
));

-- Users can update invoice totals for their own invoices
CREATE POLICY "Users can update own invoice totals" 
ON public.invoice_totals 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.invoices 
  WHERE invoices.id = invoice_totals.invoice_id 
  AND invoices.user_id = auth.uid()
));

-- Users can delete invoice totals for their own invoices
CREATE POLICY "Users can delete own invoice totals" 
ON public.invoice_totals 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.invoices 
  WHERE invoices.id = invoice_totals.invoice_id 
  AND invoices.user_id = auth.uid()
));