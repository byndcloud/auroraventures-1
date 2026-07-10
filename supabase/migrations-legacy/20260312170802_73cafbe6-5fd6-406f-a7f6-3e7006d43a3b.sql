
-- Allow authenticated users to read call_fields for active calls
CREATE POLICY "authenticated_read_call_fields"
ON public.call_fields
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.calls
    WHERE calls.id = call_fields.call_id
      AND calls.status = 'ativa'
      AND (calls.deadline IS NULL OR calls.deadline >= CURRENT_DATE)
  )
);
