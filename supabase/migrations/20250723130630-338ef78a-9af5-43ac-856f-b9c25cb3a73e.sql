-- Enable RLS on missing tables (excluding views)
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies for invoice_templates (public access for now)
CREATE POLICY "Allow all operations on invoice_templates" 
ON invoice_templates 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create policies for invoices (public access for now)
CREATE POLICY "Allow all operations on invoices" 
ON invoices 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create policies for payments (public access for now)
CREATE POLICY "Allow all operations on payments" 
ON payments 
FOR ALL 
USING (true)
WITH CHECK (true);