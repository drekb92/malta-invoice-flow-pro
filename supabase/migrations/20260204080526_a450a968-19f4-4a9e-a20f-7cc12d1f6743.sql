-- Fix invoice INV-2026-002 status from 'pending' to 'draft' so it can be edited
UPDATE invoices 
SET status = 'draft' 
WHERE id = 'd10e8737-3abc-4a38-916c-77d6ab3f3122' 
  AND is_issued = false;