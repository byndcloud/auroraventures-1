-- ============================================================================
-- C4 — transcript_path: fim das transcrições que "somem"
-- ============================================================================
-- meetings.transcript_url guardava uma SIGNED URL com expiração de 1h — depois
-- disso o link era inútil e cada consumidor re-extraía o path via regex.
-- Passamos a persistir o PATH do arquivo no bucket 'transcripts' e a assinar
-- sob demanda. Backfill extrai o path das signed URLs já gravadas.

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript_path text;

COMMENT ON COLUMN public.meetings.transcript_path IS
  'Path do arquivo no bucket transcripts (fonte de verdade; signed URL é gerada sob demanda)';

-- Backfill: signed URL tem o formato .../object/sign/transcripts/<path>?token=...
UPDATE public.meetings
SET transcript_path = regexp_replace(
      split_part(transcript_url, '/object/sign/transcripts/', 2),
      '\?.*$', ''
    )
WHERE transcript_url IS NOT NULL
  AND transcript_path IS NULL
  AND position('/object/sign/transcripts/' IN transcript_url) > 0;

-- Paths vêm URL-encoded na signed URL; decodifica os casos comuns (%20 etc.)
UPDATE public.meetings
SET transcript_path = replace(transcript_path, '%20', ' ')
WHERE transcript_path LIKE '%\%20%';
