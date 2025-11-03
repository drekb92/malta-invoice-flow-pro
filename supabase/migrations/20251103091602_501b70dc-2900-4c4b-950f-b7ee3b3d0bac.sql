-- Enable RLS on invoice_templates table to protect banking details
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- Enable RLS on invoice_counters table to protect business data
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for invoice_counters (business owners only)
CREATE POLICY "Users can view own invoice counters"
ON public.invoice_counters
FOR SELECT
USING (auth.uid() = business_id);

CREATE POLICY "Users can insert own invoice counters"
ON public.invoice_counters
FOR INSERT
WITH CHECK (auth.uid() = business_id);

CREATE POLICY "Users can update own invoice counters"
ON public.invoice_counters
FOR UPDATE
USING (auth.uid() = business_id);

-- Enable RLS on credit_note_counters table for consistency
ALTER TABLE public.credit_note_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit note counters"
ON public.credit_note_counters
FOR SELECT
USING (auth.uid() = business_id);

CREATE POLICY "Users can insert own credit note counters"
ON public.credit_note_counters
FOR INSERT
WITH CHECK (auth.uid() = business_id);

CREATE POLICY "Users can update own credit note counters"
ON public.credit_note_counters
FOR UPDATE
USING (auth.uid() = business_id);