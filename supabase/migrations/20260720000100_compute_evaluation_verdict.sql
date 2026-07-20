-- ============================================================================
-- Scorecard · Fonte única server-side
-- ============================================================================
-- Fecha o débito B10 do BLUEPRINT §8: fórmula do scorecard duplicada entre
-- src/components/admin/scorecard.ts e supabase/functions/volund-evaluation-callback/index.ts.
-- Depois desta migration, o cálculo autoritativo de final_score / has_veto /
-- verdict fica UMA SÓ VEZ, aqui, e roda como trigger BEFORE INSERT/UPDATE
-- em public.evaluations.
--
-- Modelo (§2.5 do BLUEPRINT):
--   Nota Final = (Σ Bloco1_i × peso_i / 100) × 0.60
--              + (Σ Bloco2_i × peso_i / 100) × 0.40
--   Cada critério é 0..100 (front rescala 0..10 → 0..100 antes de gravar).
--   Vetos: flags booleanas em scores como `veto_<key>`. Qualquer veto true →
--   verdict = 'REPROVADO'. Sem veto: >80 Aprovar, ≥60 Amadurecer, senão Kill.
--
-- Trigger: se scores é '{}'::jsonb (edição parcial em rascunho), preserva
-- valores existentes. Só recalcula quando há pelo menos uma nota numérica.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. compute_evaluation_verdict(scores, submission_type)
-- ----------------------------------------------------------------------------
-- Recebe:
--   scores          jsonb — {chave: nota_0_100} + {veto_<key>: bool}
--   submission_type text  — 'mercado' | 'interna' | 'editais'
-- Devolve:
--   jsonb { final_score: numeric, has_veto: boolean, verdict: text }
--
-- SECURITY DEFINER + STABLE — sem side effects, resultado depende só dos args.
-- Retorna verdict='' e final_score=0 quando scores é vazio (evita marcar Kill
-- em avaliações pending sem notas ainda).
CREATE OR REPLACE FUNCTION public.compute_evaluation_verdict(
  scores          jsonb,
  submission_type text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Pesos e vetos codificados aqui — devem espelhar
  -- src/components/admin/scorecard.ts (BLOCO1_FIELDS, BLOCO2_FIELDS).
  bloco1 CONSTANT jsonb := jsonb_build_array(
    jsonb_build_object('key','diferencial',         'weight',10, 'veto',false),
    jsonb_build_object('key','alinhamento',         'weight',10, 'veto',false),
    jsonb_build_object('key','problemaReal',        'weight',10, 'veto',false),
    jsonb_build_object('key','tamSamSom',           'weight',10, 'veto',false),
    jsonb_build_object('key','escalaReceita',       'weight',10, 'veto',false),
    jsonb_build_object('key','escalaB2G',           'weight',10, 'veto',false),
    jsonb_build_object('key','infraAprov',          'weight', 5, 'veto',false),
    jsonb_build_object('key','velocidadeMVP',       'weight',10, 'veto',false),
    jsonb_build_object('key','vibeCoding',          'weight', 5, 'veto',false),
    jsonb_build_object('key','riscoRegulatorio',    'weight',10, 'veto',true),
    jsonb_build_object('key','conhecimentoInterno', 'weight', 5, 'veto',false),
    jsonb_build_object('key','processoComercial',   'weight', 5, 'veto',false)
  );
  bloco2 jsonb;
  b1_sum numeric := 0;
  b2_sum numeric := 0;
  f      jsonb;
  key    text;
  weight numeric;
  is_veto boolean;
  nota   numeric;
  has_any_score boolean := false;
  has_veto_flag boolean := false;
  final_score numeric;
  verdict text;
BEGIN
  -- Bloco 2 varia por origem (mesmo shape que BLOCO2_FIELDS[origin] no front).
  bloco2 := CASE lower(coalesce(submission_type, 'mercado'))
    WHEN 'mercado' THEN jsonb_build_array(
      jsonb_build_object('key','perfilFounder','weight',20,'veto',true),
      jsonb_build_object('key','donoBriga',    'weight',20,'veto',false),
      jsonb_build_object('key','sinergiaCAC',  'weight',20,'veto',false),
      jsonb_build_object('key','gapEntrega',   'weight',20,'veto',false),
      jsonb_build_object('key','canaisVenda',  'weight',20,'veto',false)
    )
    WHEN 'interna' THEN jsonb_build_array(
      jsonb_build_object('key','disponibilidadeReal', 'weight',30,'veto',true),
      jsonb_build_object('key','perfilEmpreendedor',  'weight',25,'veto',true),
      jsonb_build_object('key','donoBriga',           'weight',25,'veto',false),
      jsonb_build_object('key','canaisNetwork',       'weight',20,'veto',false)
    )
    WHEN 'editais' THEN jsonb_build_array(
      jsonb_build_object('key','pi',              'weight',20,'veto',true),
      jsonb_build_object('key','cobertura',       'weight',15,'veto',false),
      jsonb_build_object('key','matchRecursos',   'weight',15,'veto',false),
      jsonb_build_object('key','atestados',       'weight',15,'veto',true),
      jsonb_build_object('key','ecossistema',     'weight',10,'veto',false),
      jsonb_build_object('key','fluxoCaixa',      'weight',15,'veto',false),
      jsonb_build_object('key','roiBurocratico',  'weight',10,'veto',true)
    )
    ELSE jsonb_build_array()
  END;

  IF scores IS NULL OR jsonb_typeof(scores) <> 'object' THEN
    RETURN jsonb_build_object('final_score', 0, 'has_veto', false, 'verdict', '');
  END IF;

  -- Bloco 1
  FOR f IN SELECT * FROM jsonb_array_elements(bloco1) LOOP
    key     := f->>'key';
    weight  := (f->>'weight')::numeric;
    is_veto := (f->>'veto')::boolean;
    nota    := NULL;
    IF (scores ? key) AND jsonb_typeof(scores->key) = 'number' THEN
      nota := (scores->>key)::numeric;
      b1_sum := b1_sum + nota * (weight / 100.0);
      has_any_score := true;
    END IF;
    IF is_veto
       AND (scores ? ('veto_' || key))
       AND jsonb_typeof(scores->('veto_' || key)) = 'boolean'
       AND (scores->>('veto_' || key))::boolean THEN
      has_veto_flag := true;
    END IF;
  END LOOP;

  -- Bloco 2 (por origem)
  FOR f IN SELECT * FROM jsonb_array_elements(bloco2) LOOP
    key     := f->>'key';
    weight  := (f->>'weight')::numeric;
    is_veto := (f->>'veto')::boolean;
    nota    := NULL;
    IF (scores ? key) AND jsonb_typeof(scores->key) = 'number' THEN
      nota := (scores->>key)::numeric;
      b2_sum := b2_sum + nota * (weight / 100.0);
      has_any_score := true;
    END IF;
    IF is_veto
       AND (scores ? ('veto_' || key))
       AND jsonb_typeof(scores->('veto_' || key)) = 'boolean'
       AND (scores->>('veto_' || key))::boolean THEN
      has_veto_flag := true;
    END IF;
  END LOOP;

  -- Sem nenhuma nota, devolve neutro (evita "Kill" em avaliações vazias).
  IF NOT has_any_score THEN
    RETURN jsonb_build_object('final_score', 0, 'has_veto', has_veto_flag, 'verdict', '');
  END IF;

  final_score := round((b1_sum * 0.6 + b2_sum * 0.4)::numeric, 2);
  -- Clamp defensivo — pesos + rescalonamento poderiam gerar 100.0001 em edge cases.
  IF final_score < 0   THEN final_score := 0;   END IF;
  IF final_score > 100 THEN final_score := 100; END IF;

  IF has_veto_flag THEN
    verdict := 'REPROVADO';
  ELSIF final_score > 80 THEN
    verdict := 'Aprovar';
  ELSIF final_score >= 60 THEN
    verdict := 'Amadurecer';
  ELSE
    verdict := 'Kill';
  END IF;

  RETURN jsonb_build_object(
    'final_score', final_score,
    'has_veto',    has_veto_flag,
    'verdict',     verdict
  );
END;
$$;

COMMENT ON FUNCTION public.compute_evaluation_verdict(jsonb, text) IS
  'Fonte única server-side do scorecard. Devolve {final_score, has_veto, verdict}. Espelha src/components/admin/scorecard.ts — mudanças de pesos exigem alterar os DOIS lados.';

REVOKE EXECUTE ON FUNCTION public.compute_evaluation_verdict(jsonb, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.compute_evaluation_verdict(jsonb, text) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. Trigger evaluations_recompute_verdict
-- ----------------------------------------------------------------------------
-- BEFORE INSERT OR UPDATE em public.evaluations. Recalcula final_score /
-- has_veto / verdict a partir de scores + submission.type sempre que scores
-- é preenchida (não-vazia). Isso vale tanto para:
--   - Volund evaluation callback (que agora só grava scores e deixa o trigger
--     recalcular).
--   - Avaliações manuais (novo INSERT/UPDATE do admin — front vira exibição).
--
-- Segurança: SECURITY DEFINER para conseguir consultar submissions.type sem
-- depender do search_path do caller. Sem side-effect além do NEW.
CREATE OR REPLACE FUNCTION public.evaluations_recompute_verdict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _submission_type text;
  _result          jsonb;
  _has_score       boolean;
BEGIN
  -- Só recalcula se scores tem pelo menos uma nota numérica ou flag de veto.
  IF NEW.scores IS NULL OR jsonb_typeof(NEW.scores) <> 'object' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM jsonb_each(NEW.scores) kv
     WHERE jsonb_typeof(kv.value) IN ('number','boolean')
  ) INTO _has_score;

  IF NOT _has_score THEN
    RETURN NEW;
  END IF;

  SELECT s.type INTO _submission_type
    FROM public.submissions s
   WHERE s.id = NEW.submission_id;

  _result := public.compute_evaluation_verdict(NEW.scores, _submission_type);

  NEW.final_score := (_result->>'final_score')::numeric;
  NEW.has_veto    := (_result->>'has_veto')::boolean;
  NEW.verdict     := _result->>'verdict';

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.evaluations_recompute_verdict() IS
  'Trigger BEFORE INSERT/UPDATE em evaluations: recalcula final_score/has_veto/verdict via compute_evaluation_verdict. Front e Edge Function não precisam mais duplicar a fórmula.';

REVOKE EXECUTE ON FUNCTION public.evaluations_recompute_verdict() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS evaluations_recompute_verdict_trigger ON public.evaluations;

CREATE TRIGGER evaluations_recompute_verdict_trigger
  BEFORE INSERT OR UPDATE OF scores, submission_id ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.evaluations_recompute_verdict();


-- ============================================================================
-- Rollback (referência):
--   DROP TRIGGER IF EXISTS evaluations_recompute_verdict_trigger ON public.evaluations;
--   DROP FUNCTION IF EXISTS public.evaluations_recompute_verdict();
--   DROP FUNCTION IF EXISTS public.compute_evaluation_verdict(jsonb, text);
-- ============================================================================
