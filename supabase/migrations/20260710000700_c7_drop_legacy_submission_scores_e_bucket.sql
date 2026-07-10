-- ============================================================================
-- C7 — Remove a tabela legada submission_scores e o bucket órfão
-- ============================================================================
-- submission_scores (1:1) foi substituída por evaluations (1:N) com backfill
-- na migration 20260610130000. O front e o MCP já leem apenas evaluations.
--
-- SALVAGUARDA: aborta se existir alguma linha em submission_scores que não
-- tenha correspondente em evaluations (backfill incompleto).

DO $$
DECLARE
  missing integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'submission_scores'
  ) THEN
    SELECT COUNT(*) INTO missing
    FROM public.submission_scores ss
    WHERE NOT EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = ss.id);

    IF missing > 0 THEN
      RAISE EXCEPTION
        'submission_scores tem % linha(s) sem correspondente em evaluations — backfill incompleto, DROP abortado',
        missing;
    END IF;

    DROP TABLE public.submission_scores;
  END IF;
END $$;

-- Bucket órfão 'meeting-transcripts' (criado na A3.2; o código sempre usou
-- 'transcripts'). Remove a policy e o bucket apenas se estiver vazio.
DROP POLICY IF EXISTS "admin_manage_transcripts" ON storage.objects;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = 'meeting-transcripts'
  ) THEN
    DELETE FROM storage.buckets WHERE id = 'meeting-transcripts';
  ELSE
    RAISE NOTICE 'bucket meeting-transcripts contém objetos — migrar manualmente antes de remover';
  END IF;
END $$;
