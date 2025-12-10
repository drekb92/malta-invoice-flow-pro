-- Drop the existing restrictive policy for managing credit note items
DROP POLICY IF EXISTS "Users can manage own credit note items" ON public.credit_note_items;

-- Create a proper INSERT policy that allows inserting items for user's own credit notes (any status)
CREATE POLICY "Users can insert own credit note items" 
ON public.credit_note_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM credit_notes
    WHERE credit_notes.id = credit_note_items.credit_note_id 
    AND credit_notes.user_id = auth.uid()
  )
);

-- Create UPDATE policy for draft credit notes only
CREATE POLICY "Users can update own draft credit note items" 
ON public.credit_note_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM credit_notes
    WHERE credit_notes.id = credit_note_items.credit_note_id 
    AND credit_notes.user_id = auth.uid()
    AND credit_notes.status = 'draft'
  )
);

-- Create DELETE policy for draft credit notes only
CREATE POLICY "Users can delete own draft credit note items" 
ON public.credit_note_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM credit_notes
    WHERE credit_notes.id = credit_note_items.credit_note_id 
    AND credit_notes.user_id = auth.uid()
    AND credit_notes.status = 'draft'
  )
);