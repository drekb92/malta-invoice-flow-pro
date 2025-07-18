-- Add phone column to customers table
ALTER TABLE public.customers ADD COLUMN phone text;

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create policies for customers table (allowing all operations for now)
CREATE POLICY "Enable read access for all users" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.customers FOR DELETE USING (true);