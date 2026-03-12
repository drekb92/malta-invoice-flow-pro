
-- Create recurring_invoices table
CREATE TABLE public.recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_invoice_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  frequency text NOT NULL,
  next_run_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_generated_at timestamptz,
  total_generated integer NOT NULL DEFAULT 0
);

-- Validation trigger for frequency instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_recurring_frequency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.frequency NOT IN ('weekly', 'monthly', 'quarterly', 'annually') THEN
    RAISE EXCEPTION 'Invalid frequency: %. Must be weekly, monthly, quarterly, or annually.', NEW.frequency;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_recurring_frequency_trigger
  BEFORE INSERT OR UPDATE ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_recurring_frequency();

-- Enable RLS
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own recurring invoices" ON public.recurring_invoices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recurring invoices" ON public.recurring_invoices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recurring invoices" ON public.recurring_invoices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recurring invoices" ON public.recurring_invoices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER handle_recurring_invoices_updated_at
  BEFORE UPDATE ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
