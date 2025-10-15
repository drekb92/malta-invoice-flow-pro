-- Create services/products table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_price NUMERIC NOT NULL,
  vat_rate NUMERIC NOT NULL DEFAULT 0.18,
  unit TEXT DEFAULT 'service',
  category TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own services" 
ON public.services 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own services" 
ON public.services 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own services" 
ON public.services 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own services" 
ON public.services 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for better performance on frequent queries
CREATE INDEX idx_services_user_id ON public.services(user_id);
CREATE INDEX idx_services_usage_count ON public.services(user_id, usage_count DESC);
CREATE INDEX idx_services_category ON public.services(user_id, category);

-- Insert default Malta-specific service templates
INSERT INTO public.services (user_id, name, description, default_price, vat_rate, unit, category, usage_count) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Accounting Services', 'Professional accounting and bookkeeping services', 500.00, 0.18, 'hour', 'professional_services', 0),
  ('00000000-0000-0000-0000-000000000000', 'Legal Consultation', 'Legal advisory and consultation services', 150.00, 0.18, 'hour', 'professional_services', 0),
  ('00000000-0000-0000-0000-000000000000', 'Web Development', 'Website design and development services', 75.00, 0.18, 'hour', 'professional_services', 0),
  ('00000000-0000-0000-0000-000000000000', 'Graphic Design', 'Creative design services', 50.00, 0.18, 'hour', 'professional_services', 0),
  ('00000000-0000-0000-0000-000000000000', 'Equipment Rental', 'Equipment rental services', 100.00, 0.18, 'day', 'goods', 0),
  ('00000000-0000-0000-0000-000000000000', 'Training Services', 'Professional training and workshops', 300.00, 0.18, 'session', 'professional_services', 0)
ON CONFLICT DO NOTHING;