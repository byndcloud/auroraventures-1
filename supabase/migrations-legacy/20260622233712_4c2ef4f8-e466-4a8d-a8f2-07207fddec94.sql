
-- 1) call_responses: also validate target call is active and within deadline
DROP POLICY IF EXISTS "authenticated_insert_responses" ON public.call_responses;
CREATE POLICY "authenticated_insert_responses"
ON public.call_responses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    respondent_email IS NULL
    OR lower(respondent_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
  )
  AND EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.id = call_id
      AND c.status = 'ativa'
      AND (c.deadline IS NULL OR c.deadline >= CURRENT_DATE)
  )
);

-- 2) Storage UPDATE policies for transcripts and week-documents (admins only)
CREATE POLICY "Admins update transcripts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'transcripts' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'transcripts' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update week documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'week-documents' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'week-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Remove user_roles from realtime publication to prevent any authenticated
--    user from subscribing to role-change events for other users.
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_roles;

-- 4) Founders read their own vesting data (scoped via submission ownership)
CREATE POLICY "Founders read own vesting_indicators"
ON public.vesting_indicators
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = vesting_indicators.submission_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Founders read own vesting_measurements"
ON public.vesting_measurements
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = vesting_measurements.submission_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Founders read own vesting_week_notes"
ON public.vesting_week_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = vesting_week_notes.submission_id
      AND s.user_id = auth.uid()
  )
);
