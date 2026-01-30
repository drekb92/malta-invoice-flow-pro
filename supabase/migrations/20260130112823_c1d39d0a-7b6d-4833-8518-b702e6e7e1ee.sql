-- Add delivery tracking columns to invoices table
ALTER TABLE invoices 
ADD COLUMN last_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN last_sent_channel TEXT DEFAULT NULL,
ADD COLUMN last_sent_to TEXT DEFAULT NULL;

COMMENT ON COLUMN invoices.last_sent_at IS 'Timestamp of most recent send (email/whatsapp/manual)';
COMMENT ON COLUMN invoices.last_sent_channel IS 'Channel used for last send: email, whatsapp, or manual';
COMMENT ON COLUMN invoices.last_sent_to IS 'Recipient of last send (email address or phone number)';