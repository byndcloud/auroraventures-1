ALTER TABLE public.vesting_measurements
  ADD COLUMN IF NOT EXISTS value_before NUMERIC;

COMMENT ON COLUMN public.vesting_measurements.value_before IS
  'Valor do indicador no início da semana (antes). value = valor ao fim (depois).';

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
          'value_before', vm.value_before,
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