
-- Update public read policy on calls to also check deadline
DROP POLICY IF EXISTS "public_read_active_calls" ON public.calls;
CREATE POLICY "public_read_active_calls" ON public.calls
  FOR SELECT TO public
  USING (
    status = 'ativa'
    AND visibility = 'publica'
    AND (deadline IS NULL OR deadline >= CURRENT_DATE)
  );

-- Update public read policy on call_fields to also respect deadline
DROP POLICY IF EXISTS "public_read_call_fields" ON public.call_fields;
CREATE POLICY "public_read_call_fields" ON public.call_fields
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM calls
      WHERE calls.id = call_fields.call_id
        AND calls.status = 'ativa'
        AND (calls.deadline IS NULL OR calls.deadline >= CURRENT_DATE)
    )
  );
