
-- 1. Profile INSERT: restrict role to 'founder' (trigger uses SECURITY DEFINER and bypasses)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'founder'::app_role);

-- 2. Profile UPDATE: defense-in-depth, prevent role change via WITH CHECK
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
  );

-- 3. Calls: restrict founders to public market calls only
DROP POLICY IF EXISTS authenticated_read_calls ON public.calls;
CREATE POLICY authenticated_read_calls ON public.calls
  FOR SELECT TO authenticated
  USING (
    (
      status = 'ativa'
      AND (deadline IS NULL OR deadline >= CURRENT_DATE)
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'colaborador'::app_role)
        OR has_role(auth.uid(), 'viewer'::app_role)
        OR (call_type = 'mercado' AND visibility = 'publica')
      )
    )
    OR id IN (SELECT call_id FROM public.call_responses WHERE user_id = auth.uid())
  );

-- 4. call_responses: enforce respondent_email matches the authenticated user's email
DROP POLICY IF EXISTS authenticated_insert_responses ON public.call_responses;
CREATE POLICY authenticated_insert_responses ON public.call_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      respondent_email IS NULL
      OR LOWER(respondent_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );
