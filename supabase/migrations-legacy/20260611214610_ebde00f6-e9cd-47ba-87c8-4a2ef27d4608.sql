-- 1. Tabela de links públicos
CREATE TABLE IF NOT EXISTS public.ongoing_share_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  token         UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ongoing_share_links IS
  'Token de compartilhamento público (sem login) da seção Ongoing — 1 por iniciativa, revogável via enabled=false';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ongoing_share_links TO authenticated;
GRANT ALL ON public.ongoing_share_links TO service_role;

ALTER TABLE public.ongoing_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ongoing_share_links" ON public.ongoing_share_links;
CREATE POLICY "Admins manage ongoing_share_links"
  ON public.ongoing_share_links FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS ongoing_share_links_updated_at ON public.ongoing_share_links;
CREATE TRIGGER ongoing_share_links_updated_at
  BEFORE UPDATE ON public.ongoing_share_links
  FOR EACH ROW EXECUTE FUNCTION public.set_vesting_weekly_updated_at();

-- 2. RPC pública
CREATE OR REPLACE FUNCTION public.get_public_ongoing(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'project_name', s.project_name,
    'status', s.status,
    'indicators', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', vi.id,
          'submission_id', vi.submission_id,
          'name', vi.name,
          'goal_description', vi.goal_description,
          'weight', vi.weight,
          'status', vi.status,
          'target_value', vi.target_value,
          'current_value', vi.current_value,
          'unit', vi.unit,
          'direction', vi.direction,
          'progress_pct', vi.progress_pct,
          'owner_name', vi.owner_name,
          'evidence_url', vi.evidence_url,
          'notes', vi.notes,
          'display_order', vi.display_order,
          'created_at', vi.created_at,
          'updated_at', vi.updated_at
        )
        ORDER BY vi.display_order NULLS LAST, vi.created_at
      )
      FROM public.vesting_indicators vi
      WHERE vi.submission_id = s.id
    ), '[]'::jsonb),
    'measurements', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', vm.id,
          'submission_id', vm.submission_id,
          'indicator_id', vm.indicator_id,
          'week_number', vm.week_number,
          'value', vm.value,
          'status', vm.status,
          'comment', vm.comment
        )
        ORDER BY vm.week_number
      )
      FROM public.vesting_measurements vm
      WHERE vm.submission_id = s.id
    ), '[]'::jsonb),
    'week_notes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', vn.id,
          'submission_id', vn.submission_id,
          'week_number', vn.week_number,
          'difficulties', vn.difficulties,
          'highlights', vn.highlights
        )
        ORDER BY vn.week_number
      )
      FROM public.vesting_week_notes vn
      WHERE vn.submission_id = s.id
    ), '[]'::jsonb)
  )
  FROM public.ongoing_share_links l
  JOIN public.submissions s ON s.id = l.submission_id
  WHERE l.token = p_token
    AND l.enabled = true;
$$;

REVOKE ALL ON FUNCTION public.get_public_ongoing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ongoing(uuid) TO anon, authenticated;