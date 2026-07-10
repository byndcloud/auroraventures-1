
-- Table: calls
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  vertical text,
  call_type text NOT NULL DEFAULT 'mercado',
  visibility text NOT NULL DEFAULT 'publica',
  status text NOT NULL DEFAULT 'ativa',
  deadline date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: call_fields
CREATE TABLE public.call_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  field_type text NOT NULL DEFAULT 'text',
  label text NOT NULL,
  placeholder text,
  required boolean NOT NULL DEFAULT false,
  options jsonb,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: call_responses
CREATE TABLE public.call_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  respondent_email text,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_responses ENABLE ROW LEVEL SECURITY;

-- Admin full access to calls
CREATE POLICY "admin_manage_calls" ON public.calls FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access to call_fields
CREATE POLICY "admin_manage_call_fields" ON public.call_fields FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access to call_responses
CREATE POLICY "admin_manage_call_responses" ON public.call_responses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public can read active public calls
CREATE POLICY "public_read_active_calls" ON public.calls FOR SELECT TO public
  USING (status = 'ativa' AND visibility = 'publica');

-- Public can read fields of accessible calls
CREATE POLICY "public_read_call_fields" ON public.call_fields FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.calls WHERE id = call_id AND status = 'ativa'));

-- Authenticated users can submit responses
CREATE POLICY "authenticated_insert_responses" ON public.call_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own responses
CREATE POLICY "users_read_own_responses" ON public.call_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Update trigger for calls
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
