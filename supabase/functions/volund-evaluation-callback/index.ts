// ============================================================================
// Edge Function: volund-evaluation-callback
// ============================================================================
// Recebe o webhook do Volund OS quando o agente Avaliador conclui um run.
// Valida HMAC, parseia o JSON estruturado retornado pela skill V1, recalcula
// final_score / has_veto / verdict server-side (single source of truth) e
// persiste em `evaluations`.
//
// O Volund chama:
//   POST {SUPABASE_URL}/functions/v1/volund-evaluation-callback?evaluation=<uuid>&token=<hmac>
//
// Idempotência: callbacks duplicados não sobrescrevem registros completos.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { hmacSign, safeEquals } from "../_shared/hmac.ts";

// ── Replica de src/components/admin/scorecard.ts ────────────────────────────
// Mantenha em sincronia com o arquivo no front. Server é a fonte da verdade
// para final_score / has_veto / verdict (front apenas exibe).

type Origin = "mercado" | "interna" | "editais";

interface Field {
  key: string;
  weight: number;
  isVeto?: boolean;
}

const BLOCO1: Field[] = [
  { key: "diferencial", weight: 10 },
  { key: "alinhamento", weight: 10 },
  { key: "problemaReal", weight: 10 },
  { key: "tamSamSom", weight: 10 },
  { key: "escalaReceita", weight: 10 },
  { key: "escalaB2G", weight: 10 },
  { key: "infraAprov", weight: 5 },
  { key: "velocidadeMVP", weight: 10 },
  { key: "vibeCoding", weight: 5 },
  { key: "riscoRegulatorio", weight: 10, isVeto: true },
  { key: "conhecimentoInterno", weight: 5 },
  { key: "processoComercial", weight: 5 },
];

const BLOCO2: Record<Origin, Field[]> = {
  mercado: [
    { key: "perfilFounder", weight: 20, isVeto: true },
    { key: "donoBriga", weight: 20 },
    { key: "sinergiaCAC", weight: 20 },
    { key: "gapEntrega", weight: 20 },
    { key: "canaisVenda", weight: 20 },
  ],
  interna: [
    { key: "disponibilidadeReal", weight: 30, isVeto: true },
    { key: "perfilEmpreendedor", weight: 25, isVeto: true },
    { key: "donoBriga", weight: 25 },
    { key: "canaisNetwork", weight: 20 },
  ],
  editais: [
    { key: "pi", weight: 20, isVeto: true },
    { key: "cobertura", weight: 15 },
    { key: "matchRecursos", weight: 15 },
    { key: "atestados", weight: 15, isVeto: true },
    { key: "ecossistema", weight: 10 },
    { key: "fluxoCaixa", weight: 15 },
    { key: "roiBurocratico", weight: 10, isVeto: true },
  ],
};

function calcFinalScore(
  scores: Record<string, number | boolean>,
  origin: Origin,
): number {
  const sum = (fields: Field[]) =>
    fields.reduce((acc, f) => {
      const v = scores[f.key];
      return typeof v === "number" ? acc + v * (f.weight / 100) : acc;
    }, 0);
  return sum(BLOCO1) * 0.6 + sum(BLOCO2[origin]) * 0.4;
}

function checkVetos(
  scores: Record<string, number | boolean>,
  origin: Origin,
): boolean {
  return [...BLOCO1, ...BLOCO2[origin]].some(
    (f) => f.isVeto && scores[`veto_${f.key}`] === true,
  );
}

function getVerdict(score: number, hasVeto: boolean): string {
  if (hasVeto) return "REPROVADO";
  if (score > 80) return "Aprovar";
  if (score >= 60) return "Amadurecer";
  return "Kill";
}

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

// Mapa: aliases (snake_case ou label PT) → chave canônica camelCase usada no
// SCORECARD_META. Cobre Bloco 1 e Bloco 2 dos 3 origins.
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
  // Heurística: se já está em camelCase reconhecido, devolve direto
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
        // {nota, peso} → extrai nota
        if (typeof nested.nota === "number") {
          const canon = canonicalKey(k);
          if (canon) out[canon] = nested.nota as number;
        } else {
          // grupo aninhado (geral, especifico, bloco1, bloco2...)
          visit(nested);
        }
      }
    }
  };
  visit(raw as Record<string, unknown>);
  return out;
}

// Flatten descriptions following the same nested/snake_case rules.
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

// Se todas as notas ≤ 10, assume escala 0-10 e multiplica por 10 para
// alinhar à escala 0-100 esperada pelo front e pelo calcFinalScore.
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

// Normaliza vetos para o shape esperado pelo front: { veto_<key>: boolean }.
// Aceita:
//   - { veto_xxx: true, ... }
//   - { xxx: true, ... }
//   - { acionados: false } (significa nenhum veto)
//   - { acionados: [<key>, ...] } (lista de vetos acionados)
function normalizeVetos(
  raw: unknown,
  origin: Origin,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const vetoKeys = [...BLOCO1, ...BLOCO2[origin]].filter((f) => f.isVeto).map((f) => f.key);
  // Inicializa todos como false
  for (const k of vetoKeys) out[`veto_${k}`] = false;
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  // Caso "acionados"
  if ("acionados" in obj) {
    const a = obj.acionados;
    if (Array.isArray(a)) {
      for (const item of a) {
        if (typeof item !== "string") continue;
        const canon = canonicalKey(item);
        if (canon && vetoKeys.includes(canon)) out[`veto_${canon}`] = true;
      }
    }
    // Se for boolean (false), mantém tudo false
    return out;
  }
  // Caso flat: { veto_xxx: true } ou { xxx: true }
  for (const [k, v] of Object.entries(obj)) {
    if (v !== true) continue;
    const raw = k.startsWith("veto_") ? k.slice(5) : k;
    const canon = canonicalKey(raw);
    if (canon && vetoKeys.includes(canon)) out[`veto_${canon}`] = true;
  }
  return out;
}

// Tenta extrair texto humano do summary mesmo quando o agente coloca um
// objeto JSON (e.g. { startup, resumo_executivo, ... }) no campo.
function extractSummary(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.resumo_executivo === "string") return obj.resumo_executivo;
      }
    } catch {
      /* string normal, devolve como veio */
    }
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
    // Fallback: agente devolveu markdown com cercas — extrai JSON
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

    // Carrega evaluation + type da submission (precisa pra calc)
    const { data: current } = await admin
      .from("evaluations")
      .select("processing_status, submission_id, submissions:submission_id(type)")
      .eq("id", evaluationId)
      .maybeSingle();

    if (!current) return json({ error: "Evaluation not found" }, 404);
    if (current.processing_status === "completed") {
      return json({ ok: true, skipped: "already_completed" }, 200);
    }

    // Falha reportada pelo Volund
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

    // Origin vem da submission (relação aninhada na query acima)
    const subRel = current.submissions as { type?: string } | null;
    const origin = (subRel?.type ?? "mercado") as Origin;

    // Normalização — tolera nested {geral, especifico}, {nota, peso},
    // snake_case / labels PT, escala 0-10 ou 0-100, vetos em vários formatos.
    const flatScores = rescaleIfNeeded(flattenScores(parsed.scores));
    const flatDescriptions = flattenDescriptions(parsed.descriptions);
    // Vetos podem vir em parsed.vetos OU dentro de parsed.scores.acionados
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

    // Merge: scores numéricos + flags de veto (front lê veto_<key> de scores)
    const merged: Record<string, number | boolean> = { ...flatScores, ...vetoFlags };

    const finalScore = calcFinalScore(merged, origin);
    const hasVeto = checkVetos(merged, origin);
    const verdict = getVerdict(finalScore, hasVeto);

    const { error: updateErr } = await admin
      .from("evaluations")
      .update({
        scores: merged,
        descriptions: Object.keys(flatDescriptions).length > 0 ? flatDescriptions : null,
        report: parsed.report ?? null,
        summary: extractSummary(parsed.summary),
        final_score: Number(finalScore.toFixed(2)),
        has_veto: hasVeto,
        verdict,
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
