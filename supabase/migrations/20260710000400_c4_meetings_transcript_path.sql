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

-- Paths vêm URL-encoded na signed URL. Precisamos de decode completo:
-- só substituir %20 quebra downloads de arquivos com acento (%C3%A9), parênteses
-- (%28/%29), + etc. Percorremos o texto byte a byte, montamos um bytea com os
-- pares hex de %XX e reinterpretamos como UTF-8 no final — assim caracteres
-- multi-byte (comuns em nomes de arquivo em português) são reconstruídos.
DO $$
DECLARE
  r record;
  buf bytea;
  i integer;
  ch text;
  decoded text;
BEGIN
  FOR r IN
    SELECT id, transcript_path
      FROM public.meetings
     WHERE transcript_path IS NOT NULL
       AND transcript_path LIKE '%\%%' ESCAPE '\'
  LOOP
    buf := ''::bytea;
    i := 1;
    WHILE i <= length(r.transcript_path) LOOP
      ch := substr(r.transcript_path, i, 1);
      IF ch = '%' AND i + 2 <= length(r.transcript_path)
         AND substr(r.transcript_path, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' THEN
        buf := buf || decode(substr(r.transcript_path, i + 1, 2), 'hex');
        i := i + 3;
      ELSE
        buf := buf || convert_to(ch, 'UTF8');
        i := i + 1;
      END IF;
    END LOOP;
    decoded := convert_from(buf, 'UTF8');
    IF decoded <> r.transcript_path THEN
      UPDATE public.meetings SET transcript_path = decoded WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Auditoria: URLs que NÃO estavam no formato signed reconhecido (public URLs,
-- URLs externas antigas, etc.) ficaram com transcript_path = NULL. O operador
-- precisa saber para investigar manualmente antes do download parar de funcionar.
DO $$
DECLARE
  leftover integer;
BEGIN
  SELECT count(*) INTO leftover
    FROM public.meetings
   WHERE transcript_url IS NOT NULL
     AND transcript_path IS NULL;

  IF leftover > 0 THEN
    RAISE NOTICE
      'C4: % linha(s) de meetings ficaram com transcript_url != NULL mas transcript_path = NULL — formato de URL não reconhecido (public, externa ou legado). Investigar manualmente.',
      leftover;
  END IF;
END $$;
