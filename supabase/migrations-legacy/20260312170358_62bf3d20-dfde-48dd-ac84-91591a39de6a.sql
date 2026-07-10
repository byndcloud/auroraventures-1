
-- Allow authenticated users to read active calls matching their role type
CREATE POLICY "authenticated_read_calls"
ON public.calls
FOR SELECT
TO authenticated
USING (
  (status = 'ativa' AND (deadline IS NULL OR deadline >= CURRENT_DATE))
  OR
  (id IN (SELECT call_id FROM public.call_responses WHERE user_id = auth.uid()))
);
