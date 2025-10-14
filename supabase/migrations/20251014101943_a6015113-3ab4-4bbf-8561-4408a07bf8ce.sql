-- Add company_position and banking_position columns to invoice_templates table
ALTER TABLE invoice_templates
ADD COLUMN IF NOT EXISTS company_position TEXT DEFAULT 'left',
ADD COLUMN IF NOT EXISTS banking_position TEXT DEFAULT 'after-totals';

-- Add check constraints for valid values
ALTER TABLE invoice_templates
ADD CONSTRAINT company_position_check 
CHECK (company_position IN ('left', 'right', 'top-right'));

ALTER TABLE invoice_templates
ADD CONSTRAINT banking_position_check 
CHECK (banking_position IN ('after-totals', 'bottom', 'footer'));