-- Add new design-focused columns to invoice_templates
ALTER TABLE invoice_templates
ADD COLUMN IF NOT EXISTS header_layout text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS table_style text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS totals_style text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS banking_visibility boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS banking_style text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS margin_top integer DEFAULT 20,
ADD COLUMN IF NOT EXISTS margin_right integer DEFAULT 20,
ADD COLUMN IF NOT EXISTS margin_bottom integer DEFAULT 20,
ADD COLUMN IF NOT EXISTS margin_left integer DEFAULT 20;

-- Add check constraints for the new fields
ALTER TABLE invoice_templates
ADD CONSTRAINT check_header_layout CHECK (header_layout IN ('default', 'centered', 'split')),
ADD CONSTRAINT check_table_style CHECK (table_style IN ('default', 'striped', 'bordered', 'minimal')),
ADD CONSTRAINT check_totals_style CHECK (totals_style IN ('default', 'boxed', 'highlighted')),
ADD CONSTRAINT check_banking_style CHECK (banking_style IN ('default', 'boxed', 'minimal')),
ADD CONSTRAINT check_layout_extended CHECK (layout IN ('default', 'cleanMinimal', 'compact'));

-- Drop the old check constraint if it exists
ALTER TABLE invoice_templates DROP CONSTRAINT IF EXISTS invoice_templates_layout_check;

-- Add comment explaining the separation of design and business data
COMMENT ON TABLE invoice_templates IS 'Stores invoice design and styling preferences only. Business data like logos and bank details are in company_settings and banking_details tables.';