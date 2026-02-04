-- Disable the triggers that block issued invoice updates
ALTER TABLE invoices DISABLE TRIGGER prevent_issued_invoice_updates;
ALTER TABLE invoices DISABLE TRIGGER trg_prevent_issued_invoice_edits;

-- Renumber the duplicate invoice  
UPDATE invoices 
SET invoice_number = 'INV-2026-001' 
WHERE id = 'eb51ce40-190f-48af-9e2e-05b7a93df0ec';

-- Re-enable the triggers
ALTER TABLE invoices ENABLE TRIGGER prevent_issued_invoice_updates;
ALTER TABLE invoices ENABLE TRIGGER trg_prevent_issued_invoice_edits;

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS unique_invoice_number_per_user 
ON invoices (user_id, invoice_number) 
WHERE invoice_number IS NOT NULL;

-- Initialize 2026 counter for the user
INSERT INTO invoice_counters (business_id, year, prefix, last_seq)
VALUES ('d28aef93-2cb5-44e8-96f5-5f9e5d911225', 2026, 'INV-', 1)
ON CONFLICT (business_id, year) DO UPDATE SET last_seq = GREATEST(invoice_counters.last_seq, 1);