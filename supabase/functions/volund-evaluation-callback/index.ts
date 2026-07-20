// ============================================================================
// Edge Function: volund-evaluation-callback
// ============================================================================
// Recebe o webhook do Volund OS quando o agente Avaliador conclui um run.
// Valida HMAC, parseia o JSON estruturado retornado pela skill V1, normaliza
// (nested {geral, especifico}, {nota, peso}, snake_case, 0-10 vs 0-100, vetos
// em formatos diferentes) e persiste em `evaluations`.
//
// O cálculo de final_score / has_veto / verdict é feito pelo TRIGGER
// `evaluations_recompute_verdict_trigger` (BEFORE INSERT/UPDATE em evaluations)
// que chama `public.compute_evaluation_verdict(scores, submission_type)`.
// A fonte única server-side vive no Postgres — esta função só entrega
// `scores` normalizada e deixa o trigger fechar a conta.
//
// O Volund chama:
//   POST {SUPABASE_URL}/functions/v1/volund-evaluation-callback?evaluation=<uuid>&token=<hmac>
//
// Idempotência: callbacks duplicados não sobrescrevem registros completos.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { hmacSign, safeEquals } from "../_shared/hmac.ts";
import { BLOCO1_KEYS, BLOCO2_KEYS, type Origin, vetoKeys } from "../_shared/scorecard-schema.ts";

// ── Parsing + normalização do output do agente ──────────────────────────────
// Aceita variações do output (snake_case, nested {geral, especifico},
// {nota, peso}, escala 0-10 ou 0-100, vetos em formatos diferentes) e
// normaliza para o shape esperado pelo front (flat, camelCase, 0-100).

interface AgentOutput {
  scores?: Record<string, number>;
  vetos?: Record<string, boolean>;
  descriptions?: Record<string, string>;
  report?: string;
  summary?: string;
  verdict_hint?: string;
}

// Mapa: aliases (snake_case ou label PT) → chave canônica camelCase.
// Cobre Bloco 1 e Bloco 2 dos 3 origins. Deve ser um superset das chaves
// listadas em BLOCO1_KEYS/BLOCO2_KEYS.
const KEY_ALIASES: Record<string, string> = {
  // Bloco 1
  diferencial_injusto: "diferencial",
  diferencial: "diferencial",
  alinhamento: "alinhamento",
  problema_real: "problemaReal",
  problemareal: "problemaReal",
  tam_sam_som: "tamSamSom",
  tamsamsom: "tamSamSom",
  escalabilidade_receita: "escalaReceita",
  escala_receita: "escalaReceita",
  escalareceita: "escalaReceita",
  escalabilidade_b2g: "escalaB2G",
  escala_b2g: "escalaB2G",
  escalab2g: "escalaB2G",
  aproveitamento_infra: "infraAprov",
  infra_aprov: "infraAprov",
  infraaprov: "infraAprov",
  velocidade_mvp: "velocidadeMVP",
  velocidademvp: "velocidadeMVP",
  vibe_coding: "vibeCoding",
  vibe_coding_vs_pesquisa: "vibeCoding",
  vibecoding: "vibeCoding",
  risco_regulatorio: "riscoRegulatorio",
  riscoregulatorio: "riscoRegulatorio",
  conhecimento_interno: "conhecimentoInterno",
  conhecimentointerno: "conhecimentoInterno",
  processo_comercial: "processoComercial",
  processocomercial: "processoComercial",
  // Bloco 2 — mercado
  perfil_founder: "perfilFounder",
  perfilfounder: "perfilFounder",
  dono_da_briga: "donoBriga",
  dono_briga: "donoBriga",
  donobriga: "donoBriga",
  sinergia_cac: "sinergiaCAC",
  sinergia_operacional_cac: "sinergiaCAC",
  sinergiacac: "sinergiaCAC",
  gap_entrega: "gapEntrega",
  gapentrega: "gapEntrega",
  canais_venda: "canaisVenda",
  canaisvenda: "canaisVenda",
  // Bloco 2 — interna
  disponibilidade_real: "disponibilidadeReal",
  disponibilidadereal: "disponibilidadeReal",
  perfil_empreendedor: "perfilEmpreendedor",
  perfilempreendedor: "perfilEmpreendedor",
  canais_network: "canaisNetwork",
  canaisnetwork: "canaisNetwork",
  // Bloco 2 — editais
  pi: "pi",
  cobertura: "cobertura",
  match_recursos: "matchRecursos",
  matchrecursos: "matchRecursos",
  atestados: "atestados",
  ecossistema: "ecossistema",
  fluxo_caixa: "fluxoCaixa",
  fluxocaixa: "fluxoCaixa",
  roi_burocratico: "roiBurocratico",
  roiburocratico: "roiBurocratico",
};

function canonicalKey(rawKey: string): string | null {
  const lower = rawKey.toLowerCase().replace(/[\s\-]+/g, "_");
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower];
  const camel = lower.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (KEY_ALIASES[camel.toLowerCase()]) return KEY_ALIASES[camel.toLowerCase()];
  return null;
}

// Achata estruturas aninhadas (e.g. {geral: {...}, especifico: {...}}) em um
// objeto flat. Extrai .nota se o valor for {nota, peso}.
function flattenScores(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;

  const visit = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (typeof v === "number") {
        const canon = canonicalKey(k);
        if (canon) out[canon] = v;
      } else if (typeof v === "object" && !Array.isArray(v)) {
        const nested = v as Record<string, unknown>;
        if (typeof nested.nota === "number") {
          const canon = canonicalKey(k);
          if (canon) out[canon] = nested.nota as number;
        } else {
          visit(nested);
        }
      }
    }
  };
  visit(raw as Record<string, unknown>);
  return out;
}

function flattenDescriptions(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;

  const visit = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (typeof v === "string") {
        const canon = canonicalKey(k);
        if (canon) out[canon] = v;
      } else if (typeof v === "object" && !Array.isArray(v)) {
        visit(v as Record<string, unknown>);
      }
    }
  };
  visit(raw as Record<string, unknown>);
  return out;
}

// Se todas as notas ≤ 10, assume escala 0-10 e multiplica por 10.
function rescaleIfNeeded(scores: Record<string, number>): Record<string, number> {
  const values = Object.values(scores);
  if (values.length === 0) return scores;
  const max = Math.max(...values);
  if (max <= 10) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(scores)) out[k] = v * 10;
    return out;
  }
  return scores;
}

// Normaliza vetos para { veto_<key>: boolean }, cobrindo TODOS os vetos da
// origem (mesmo os não mencionados no payload viram false explícito).
function normalizeVetos(raw: unknown, origin: Origin): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const allowedVetos = vetoKeys(origin);
  for (const k of allowedVetos) out[`veto_${k}`] = false;
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;

  if ("acionados" in obj) {
    const a = obj.acionados;
    if (Array.isArray(a)) {
      for (const item of a) {
        if (typeof item !== "string") continue;
        const canon = canonicalKey(item);
        if (canon && allowedVetos.includes(canon)) out[`veto_${canon}`] = true;
      }
    }
    return out;
  }

  for (const [k, v] of Object.entries(obj)) {
    if (v !== true) continue;
    const bare = k.startsWith("veto_") ? k.slice(5) : k;
    const canon = canonicalKey(bare);
    if (canon && allowedVetos.includes(canon)) out[`veto_${canon}`] = true;
  }
  return out;
}

function extractSummary(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.resumo_executivo === "string") return obj.resumo_executivo;
      }
    } catch { /* string livre, devolve como veio */ }
    return raw;
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.resumo_executivo === "string") return obj.resumo_executivo;
    return JSON.stringify(raw);
  }
  return String(raw);
}

function parseOutput(raw: unknown): AgentOutput | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as AgentOutput;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Garante que TODAS as chaves conhecidas do bloco 1/2 estejam presentes
// (para o trigger acionar has_any_score corretamente e para a UI não
// mostrar undefined em campos ausentes do payload do agente).
function ensureAllKeysPresent(scores: Record<string, number>, origin: Origin): Record<string, number> {
  const out = { ...scores };
  for (const f of BLOCO1_KEYS) if (!(f.key in out)) out[f.key] = 0;
  for (const f of BLOCO2_KEYS[origin]) if (!(f.key in out)) out[f.key] = 0;
  return out;
}

interface VolundCallbackBody {
  run_id?: string;
  status?: string;
  output?: unknown;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CALLBACK_SECRET = Deno.env.get("VOLUND_CALLBACK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!CALLBACK_SECRET) return json({ error: "Missing secret" }, 500);

    const url = new URL(req.url);
    const evaluationId = url.searchParams.get("evaluation");
    const token = url.searchParams.get("token");

    if (!evaluationId || !token) {
      return json({ error: "Missing evaluation or token" }, 400);
    }

    const expected = await hmacSign(evaluationId, CALLBACK_SECRET);
    if (!safeEquals(expected, token)) {
      return json({ error: "Invalid token" }, 403);
    }

    const payload: VolundCallbackBody = await req.json();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: current } = await admin
      .from("evaluations")
      .select("processing_status, submission_id, submissions:submission_id(type)")
      .eq("id", evaluationId)
      .maybeSingle();

    if (!current) return json({ error: "Evaluation not found" }, 404);
    if (current.processing_status === "completed") {
      return json({ ok: true, skipped: "already_completed" }, 200);
    }

    if (payload.status !== "completed") {
      await admin
        .from("evaluations")
        .update({
          processing_status: "failed",
          error_message: payload.error ??
            `Volund returned status=${payload.status ?? "unknown"}`,
          processed_at: new Date().toISOString(),
        })
        .eq("id", evaluationId);
      return json({ ok: true, status: "failed" }, 200);
    }

    const parsed = parseOutput(payload.output);
    if (!parsed) {
      await admin
        .from("evaluations")
        .update({
          processing_status: "failed",
          error_message: "Agent output não é JSON parseável",
          processed_at: new Date().toISOString(),
        })
        .eq("id", evaluationId);
      return json({ ok: true, status: "failed", reason: "invalid_output" }, 200);
    }

    const subRel = current.submissions as { type?: string } | null;
    const origin = (subRel?.type ?? "mercado") as Origin;

    const flatScores = rescaleIfNeeded(flattenScores(parsed.scores));
    const flatDescriptions = flattenDescriptions(parsed.descriptions);
    const vetoSource = parsed.vetos ?? parsed.scores ?? {};
    const vetoFlags = normalizeVetos(vetoSource, origin);

    if (Object.keys(flatScores).length === 0) {
      await admin
        .from("evaluations")
        .update({
          processing_status: "failed",
          error_message: "Nenhuma nota reconhecida no output do agente",
          processed_at: new Date().toISOString(),
        })
        .eq("id", evaluationId);
      return json({ ok: true, status: "failed", reason: "empty_scores" }, 200);
    }

    // Merge: notas normalizadas + flags de veto. Preenche chaves ausentes com
    // 0 para consistência com a UI. Trigger no banco recalcula
    // final_score/has_veto/verdict — não tocamos essas colunas aqui.
    const scores: Record<string, number | boolean> = {
      ...ensureAllKeysPresent(flatScores, origin),
      ...vetoFlags,
    };

    const { error: updateErr } = await admin
      .from("evaluations")
      .update({
        scores,
        descriptions: Object.keys(flatDescriptions).length > 0 ? flatDescriptions : null,
        report: parsed.report ?? null,
        summary: extractSummary(parsed.summary),
        processing_status: "completed",
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", evaluationId);

    if (updateErr) {
      return json({ error: "Update failed", detail: updateErr.message }, 500);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    );
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
