-- Add layout column to invoice_templates table
ALTER TABLE invoice_templates
ADD COLUMN layout TEXT DEFAULT 'default';

-- Update existing Clean Minimal templates to use cleanMinimal layout
UPDATE invoice_templates 
SET layout = 'cleanMinimal' 
WHERE name ILIKE '%clean%minimal%';