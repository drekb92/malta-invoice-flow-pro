-- Create document_send_logs table for tracking all document sends
CREATE TABLE public.document_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'quotation', 'statement', 'credit_note')),
  document_id UUID NOT NULL,
  document_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  share_url TEXT,
  share_url_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.document_send_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own send logs"
  ON public.document_send_logs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own send logs"
  ON public.document_send_logs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX idx_document_send_logs_lookup 
  ON public.document_send_logs(document_type, document_id, sent_at DESC);

-- Create shared_documents storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shared_documents', 'shared_documents', false);

-- Storage policies
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shared_documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Signed URL access for shared documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shared_documents');