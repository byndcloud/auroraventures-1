// ============================================================================
// Edge Function: initiative-mcp
// ============================================================================
// MCP server (read-only) exposing Aurora initiatives.
//
// Transport: Streamable HTTP. Clients must send:
//   Accept: application/json, text/event-stream
//   Content-Type: application/json
//   Authorization: Bearer <credencial>
//
// DUAS modalidades de auth (escolhidas no middleware):
//
//   1) Service token (agentes — Volund OS, integrações):
//      Authorization: Bearer <MCP_AGENT_API_KEY>
//      Bypassa RLS (usa service_role). Logado como userId='service:agent'.
//      Use APENAS em agentes confiáveis com a chave nos secrets.
//
//   2) JWT de usuário (humanos — Claude Desktop, Cursor, etc.):
//      Authorization: Bearer <user JWT do Supabase>
//      RLS aplica naturalmente — só vê o que o usuário pode ver.
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Hono } from "hono";
import { McpServer, StreamableHttpTransport, RpcError, JSON_RPC_ERROR_CODES } from "mcp-lite";
import { z } from "zod";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders as sharedCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_AGENT_API_KEY = Deno.env.get("MCP_AGENT_API_KEY") ?? "";

// Comparação tempo-constante para evitar timing attacks na validação da chave.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Extrai o path do arquivo no bucket `transcripts` a partir de uma signed URL
// (formato: /object/sign/transcripts/<path>?token=...). Devolve null se o URL
// não bater no padrão.
function extractTranscriptPath(signedUrl: string | null): string | null {
  if (!signedUrl) return null;
  const m = signedUrl.match(/\/object\/sign\/transcripts\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// CORS: usa o Access-Control-Allow-Origin restrito de _shared/cors.ts
// (secret CORS_ORIGIN) e complementa com os headers específicos do transport
// MCP (accept, mcp-session-id, mcp-protocol-version).
const corsHeaders: Record<string, string> = {
  ...sharedCors,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function textResult(payload: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function getSb(ctx: any): SupabaseClient {
  const sb = ctx?.state?.supabase as SupabaseClient | undefined;
  if (!sb) throw new RpcError(JSON_RPC_ERROR_CODES.INVALID_REQUEST, "Unauthorized");
  return sb;
}

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization") ?? request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

// ─── MCP server ────────────────────────────────────────────────────────────

const mcp = new McpServer({
  name: "aurora-initiative-mcp",
  version: "0.1.0",
  schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
});

// Auth middleware — só exige credencial para tools/call. initialize, tools/list,
// ping etc. passam sem credencial (descoberta MCP).
mcp.use(async (ctx: any, next: any) => {
  const method = ctx?.request?.method ?? ctx?.method;
  if (method !== "tools/call") {
    return next();
  }
  const token = ctx?.authInfo?.token;
  if (!token || typeof token !== "string") {
    throw new RpcError(JSON_RPC_ERROR_CODES.INVALID_REQUEST, "Missing or invalid Authorization header");
  }

  // (A) Service token estático — agente confiável (Volund OS, integrações).
  //     Bypassa RLS via service_role. Loga como service:agent para auditoria.
  if (MCP_AGENT_API_KEY && timingSafeEqual(token, MCP_AGENT_API_KEY)) {
    ctx.state.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    ctx.state.userId = "service:agent";
    ctx.state.authMode = "service";
    return next();
  }

  // (B) JWT de usuário — RLS aplica naturalmente.
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user?.id) {
    throw new RpcError(JSON_RPC_ERROR_CODES.INVALID_REQUEST, "Unauthorized: invalid JWT");
  }
  ctx.state.supabase = sb;
  ctx.state.userId = user.id;
  ctx.state.authMode = "user";
  await next();
});

const IdSchema = z.object({ id: z.string().uuid() });
const IdLimitSchema = z.object({ id: z.string().uuid(), limit: z.number().int().min(1).max(100).optional() });

// ──────────────────────────────────────────────────────────────────────────
// Tipos compartilhados — updates + blockers (espelham o contrato MCP público)
// ──────────────────────────────────────────────────────────────────────────
type UpdateSource = "meeting" | "status" | "scorecard" | "vesting" | "ongoing" | "edit";

interface UpdateItem {
  id: string;
  initiative_id: string;
  initiative_name: string;
  source: UpdateSource;
  occurred_at: string;
  title: string;
  detail: string | null;
  ref_id: string | null;
}

interface BlockerItem {
  id: string;
  initiative_id: string;
  initiative_name: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved";
  owner: string | null;
  due_date: string | null;
  source_meeting_id: string | null;
  raised_at: string;
  resolved_at: string | null;
}

// Mapeia severidade do schema do Volund (pt) para o contrato MCP (en).
const SEVERITY_MAP: Record<string, BlockerItem["severity"]> = {
  baixa: "low",
  media: "medium",
  média: "medium",
  alta: "high",
  critica: "critical",
  crítica: "critical",
};

// Extrai BlockerItems de uma reunião lendo minutes_structured.bloqueios_riscos.
// O schema do Volund não tem id/owner/due_date/status — sintetizamos id
// determinístico e marcamos todos como "open" (v1 sem tabela de resolução).
function extractBlockersFromMeeting(
  meeting: any,
  initiativeId: string,
  initiativeName: string,
): BlockerItem[] {
  const ms = meeting.minutes_structured;
  if (!ms || typeof ms !== "object") return [];
  const arr = (ms as any).bloqueios_riscos;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((b: any) => b && typeof b === "object" && typeof b.descricao === "string")
    .map((b: any, idx: number) => {
      const sev = SEVERITY_MAP[String(b.severidade ?? "").toLowerCase()] ?? "medium";
      return {
        id: `${meeting.id}#blk${idx}`,
        initiative_id: initiativeId,
        initiative_name: initiativeName,
        description: String(b.descricao).trim(),
        severity: sev,
        status: "open",
        owner: null,
        due_date: null,
        source_meeting_id: meeting.id,
        raised_at: meeting.meeting_date ?? meeting.created_at,
        resolved_at: null,
      } as BlockerItem;
    });
}

const SEVERITY_RANK: Record<BlockerItem["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Mapeia um registro de cada fonte para UpdateItem.
function meetingToUpdate(m: any, initId: string, initName: string): UpdateItem {
  const ms = m.minutes_structured;
  const detail = (ms && typeof ms === "object" && typeof (ms as any).resumo_executivo === "string")
    ? (ms as any).resumo_executivo
    : (typeof m.smart_minutes === "string" ? m.smart_minutes.slice(0, 500) : null);
  return {
    id: `meeting:${m.id}`,
    initiative_id: initId,
    initiative_name: initName,
    source: "meeting",
    occurred_at: m.meeting_date ?? m.created_at,
    title: m.title ?? "Reunião",
    detail,
    ref_id: m.id,
  };
}
function historyToUpdate(h: any, initId: string, initName: string): UpdateItem {
  const from = h.from_status ?? "—";
  const to = h.to_status ?? "—";
  return {
    id: `status:${h.id}`,
    initiative_id: initId,
    initiative_name: initName,
    source: "status",
    occurred_at: h.moved_at ?? h.created_at,
    title: `Status: ${from} → ${to}`,
    detail: null,
    ref_id: h.id,
  };
}
function evaluationToUpdate(e: any, initId: string, initName: string): UpdateItem {
  const src = e.source === "ai" ? "IA" : "manual";
  const verdict = e.verdict || "—";
  const score = e.final_score != null ? Number(e.final_score).toFixed(1) : "—";
  return {
    id: `scorecard:${e.id}`,
    initiative_id: initId,
    initiative_name: initName,
    source: "scorecard",
    occurred_at: e.created_at,
    title: `Avaliação (${src}) — ${verdict} · ${score}`,
    detail: e.summary ?? null,
    ref_id: e.id,
  };
}
function vestingToUpdate(
  meas: any,
  indicatorName: string,
  unit: string | null,
  initId: string,
  initName: string,
): UpdateItem {
  const before = meas.value_before != null ? String(meas.value_before) : "—";
  const after = meas.value != null ? String(meas.value) : "—";
  const u = unit && unit !== "R$" ? ` ${unit}` : "";
  return {
    id: `vesting:${meas.id}`,
    initiative_id: initId,
    initiative_name: initName,
    source: "vesting",
    occurred_at: meas.updated_at ?? meas.created_at,
    title: `Semana ${meas.week_number}: ${indicatorName} — ${before} / ${after}${u}`,
    detail: meas.comment ?? null,
    ref_id: meas.id,
  };
}
function weekToUpdate(w: any, initId: string, initName: string): UpdateItem {
  return {
    id: `ongoing:week:${w.id}`,
    initiative_id: initId,
    initiative_name: initName,
    source: "ongoing",
    occurred_at: w.created_at,
    title: `Semana cadastrada: ${w.title}`,
    detail: null,
    ref_id: w.id,
  };
}
function docToUpdate(d: any, initId: string, initName: string): UpdateItem {
  return {
    id: `ongoing:doc:${d.id}`,
    initiative_id: initId,
    initiative_name: initName,
    source: "ongoing",
    occurred_at: d.created_at,
    title: `Documento adicionado: ${d.file_name}`,
    detail: null,
    ref_id: d.id,
  };
}

// Coleta updates de uma única iniciativa (todas as 5 fontes) entre [since, now).
// Edit não é suportada v1 — não há audit log de edição de campos.
async function collectUpdatesForInitiative(
  sb: SupabaseClient,
  initId: string,
  initName: string,
  opts: { since?: string; sources?: UpdateSource[]; limit?: number },
): Promise<{ updates: UpdateItem[]; blockers: BlockerItem[] }> {
  const sources = opts.sources ?? ["meeting", "status", "scorecard", "vesting", "ongoing"];
  const since = opts.since ?? null;

  const updates: UpdateItem[] = [];
  const blockers: BlockerItem[] = [];

  // 1) Meetings (sempre puxamos quando precisamos de blockers OU meeting updates)
  const needMeeting = sources.includes("meeting");
  // Sempre buscamos meetings pra ter os blockers (independente da source filter)
  {
    let q = sb
      .from("meetings")
      .select("id, title, meeting_date, category, minutes_structured, smart_minutes, created_at")
      .eq("submission_id", initId)
      .order("meeting_date", { ascending: false });
    if (since) q = q.gte("meeting_date", since);
    const { data, error } = await q;
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);
    for (const m of data ?? []) {
      if (needMeeting) updates.push(meetingToUpdate(m, initId, initName));
      blockers.push(...extractBlockersFromMeeting(m, initId, initName));
    }
  }

  // 2) submission_history
  if (sources.includes("status")) {
    let q = sb
      .from("submission_history")
      .select("id, from_status, to_status, moved_at")
      .eq("submission_id", initId)
      .order("moved_at", { ascending: false });
    if (since) q = q.gte("moved_at", since);
    const { data } = await q;
    for (const h of data ?? []) updates.push(historyToUpdate(h, initId, initName));
  }

  // 3) evaluations
  if (sources.includes("scorecard")) {
    let q = sb
      .from("evaluations")
      .select("id, source, verdict, final_score, summary, created_at, processing_status")
      .eq("submission_id", initId)
      .eq("processing_status", "completed")
      .order("created_at", { ascending: false });
    if (since) q = q.gte("created_at", since);
    const { data } = await q;
    for (const e of data ?? []) updates.push(evaluationToUpdate(e, initId, initName));
  }

  // 4) vesting_measurements (precisa do nome do indicador) — só com value preenchido
  if (sources.includes("vesting")) {
    const { data: inds } = await sb
      .from("vesting_indicators")
      .select("id, name, unit")
      .eq("submission_id", initId);
    const indMap = new Map<string, { name: string; unit: string | null }>();
    for (const i of inds ?? []) indMap.set(i.id, { name: i.name, unit: i.unit ?? null });

    let q = sb
      .from("vesting_measurements")
      .select("id, indicator_id, week_number, value, value_before, comment, created_at, updated_at")
      .eq("submission_id", initId)
      .order("updated_at", { ascending: false });
    if (since) q = q.gte("updated_at", since);
    const { data } = await q;
    for (const m of data ?? []) {
      const meta = indMap.get(m.indicator_id);
      if (!meta) continue;
      updates.push(vestingToUpdate(m, meta.name, meta.unit, initId, initName));
    }
  }

  // 5) ongoing_weeks + week_documents
  if (sources.includes("ongoing")) {
    let wq = sb
      .from("ongoing_weeks")
      .select("id, title, created_at")
      .eq("submission_id", initId)
      .order("created_at", { ascending: false });
    if (since) wq = wq.gte("created_at", since);
    const { data: weeks } = await wq;
    for (const w of weeks ?? []) updates.push(weekToUpdate(w, initId, initName));

    let dq = sb
      .from("week_documents")
      .select("id, file_name, created_at")
      .eq("submission_id", initId)
      .order("created_at", { ascending: false });
    if (since) dq = dq.gte("created_at", since);
    const { data: docs } = await dq;
    for (const d of docs ?? []) updates.push(docToUpdate(d, initId, initName));
  }

  // Ordena tudo por occurred_at desc e aplica limit (se houver)
  updates.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  if (opts.limit) updates.splice(opts.limit);

  return { updates, blockers };
}

// list_initiatives
mcp.tool("list_initiatives", {
  description: "Lista iniciativas (submissions) visíveis ao usuário. RLS aplica.",
  inputSchema: z.object({
    status: z.string().optional(),
    type: z.string().optional(),
    q: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  handler: async (input, ctx) => {
    const sb = getSb(ctx);
    const limit = input.limit ?? 20;
    let q = sb
      .from("submissions")
      .select("id, project_name, type, status, due_date, created_at, data")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (input.status) q = q.eq("status", input.status);
    if (input.type) q = q.eq("type", input.type);
    if (input.q) q = q.ilike("project_name", `%${input.q}%`);
    const { data, error } = await q;
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);
    const rows = (data ?? []).map((r: any) => ({
      id: r.id,
      project_name: r.project_name,
      type: r.type,
      status: r.status,
      due_date: r.due_date,
      vertical: r.data?.vertical ?? r.data?.setor ?? null,
      created_at: r.created_at,
    }));
    return textResult({ count: rows.length, items: rows });
  },
});

// get_initiative
mcp.tool("get_initiative", {
  description: "Snapshot consolidado: submission + último scorecard + readout + vesting + contadores.",
  inputSchema: IdSchema,
  handler: async ({ id }, ctx) => {
    const sb = getSb(ctx);
    const [sub, score, readout, vesting, meetingsCount, weeksCount] = await Promise.all([
      sb.from("submissions").select("*").eq("id", id).maybeSingle(),
      // evaluations substitui a antiga submission_scores (dropada)
      sb.from("evaluations").select("*").eq("submission_id", id)
        .eq("processing_status", "completed")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("readouts").select("*").eq("submission_id", id).maybeSingle(),
      sb.from("vesting_indicators").select("*").eq("submission_id", id)
        .order("display_order", { ascending: true, nullsFirst: false }),
      sb.from("meetings").select("id", { count: "exact", head: true }).eq("submission_id", id),
      sb.from("ongoing_weeks").select("id", { count: "exact", head: true }).eq("submission_id", id),
    ]);
    if (!sub.data) throw new RpcError(JSON_RPC_ERROR_CODES.INVALID_PARAMS, "Iniciativa não encontrada (ou sem permissão).");
    return textResult({
      submission: sub.data,
      latest_score: score.data ?? null,
      readout: readout.data ?? null,
      vesting_indicators: vesting.data ?? [],
      counts: { meetings: meetingsCount.count ?? 0, ongoing_weeks: weeksCount.count ?? 0 },
    });
  },
});

// get_meetings
mcp.tool("get_meetings", {
  description: "Lista reuniões de uma iniciativa (desc por data) com atas estruturadas.",
  inputSchema: IdLimitSchema,
  handler: async ({ id, limit }, ctx) => {
    const sb = getSb(ctx);
    const { data, error } = await sb
      .from("meetings")
      .select("id, title, meeting_date, category, week_id, minutes_structured, smart_minutes, transcript_url, processing_status, created_at")
      .eq("submission_id", id)
      .order("meeting_date", { ascending: false })
      .limit(limit ?? 20);
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);
    return textResult({ count: data?.length ?? 0, items: data ?? [] });
  },
});

// get_scorecard
mcp.tool("get_scorecard", {
  description: "Scorecard mais recente (critérios, pesos, veto, verdict).",
  inputSchema: IdSchema,
  handler: async ({ id }, ctx) => {
    const sb = getSb(ctx);
    const { data, error } = await sb
      .from("evaluations")
      .select("*")
      .eq("submission_id", id)
      .eq("processing_status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);
    return textResult(data ?? { message: "Sem scorecard registrado." });
  },
});

// get_vesting
mcp.tool("get_vesting", {
  description: "Indicadores de vesting de uma iniciativa com progresso.",
  inputSchema: IdSchema,
  handler: async ({ id }, ctx) => {
    const sb = getSb(ctx);
    const { data, error } = await sb
      .from("vesting_indicators")
      .select("*")
      .eq("submission_id", id)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);
    return textResult({ count: data?.length ?? 0, items: data ?? [] });
  },
});

// get_history
mcp.tool("get_history", {
  description:
    "Audit log (submission_history) das mudanças de uma iniciativa. " +
    "Filtro temporal opcional via 'since' (ISO 8601) para o digest semanal.",
  inputSchema: z.object({
    id: z.string().uuid(),
    since: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  handler: async ({ id, since, limit }, ctx) => {
    const sb = getSb(ctx);
    let q = sb
      .from("submission_history")
      .select("*")
      .eq("submission_id", id)
      .order("moved_at", { ascending: false })
      .limit(limit ?? 20);
    if (since) q = q.gte("moved_at", since);
    const { data, error } = await q;
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);
    return textResult({ count: data?.length ?? 0, items: data ?? [] });
  },
});

// get_transcript
mcp.tool("get_transcript", {
  description:
    "Conteúdo BRUTO da transcrição de uma reunião (texto da .txt/.vtt/.srt/.md). " +
    "Resolve via Storage (bucket 'transcripts') quando o fluxo é Volund, ou " +
    "via meetings.transcript no fluxo manual legado. RLS é validada antes do " +
    "download em modo usuário; modo service bypassa RLS.",
  inputSchema: z.object({ meeting_id: z.string().uuid() }),
  handler: async ({ meeting_id }, ctx) => {
    const sb = getSb(ctx);
    const { data: m, error } = await sb
      .from("meetings")
      .select("id, submission_id, title, meeting_date, category, transcript, transcript_url, transcript_path, source")
      .eq("id", meeting_id)
      .maybeSingle();
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);
    if (!m) {
      throw new RpcError(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        "Reunião não encontrada (ou sem permissão).",
      );
    }

    // (1) Fluxo manual legado — texto já está no banco
    if (m.transcript && m.transcript.trim().length > 0) {
      return textResult({
        meeting_id: m.id,
        submission_id: m.submission_id,
        title: m.title,
        meeting_date: m.meeting_date,
        category: m.category,
        source: m.source ?? "manual_db",
        content_length: m.transcript.length,
        content: m.transcript,
      });
    }

    // (2) Fluxo Volund — baixar do Storage. Usa service_role apenas para o
    //     download em si (o passo RLS já foi feito no SELECT acima).
    //     transcript_path é a fonte preferida; fallback extrai da signed URL legada.
    const path = m.transcript_path ?? extractTranscriptPath(m.transcript_url);
    if (!path) {
      throw new RpcError(
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        "Transcrição indisponível (sem path no Storage).",
      );
    }
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: blob, error: dlErr } = await admin.storage
      .from("transcripts")
      .download(path);
    if (dlErr || !blob) {
      throw new RpcError(
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        `Falha ao baixar transcrição: ${dlErr?.message ?? "blob vazio"}`,
      );
    }
    const text = await blob.text();
    return textResult({
      meeting_id: m.id,
      submission_id: m.submission_id,
      title: m.title,
      meeting_date: m.meeting_date,
      category: m.category,
      source: m.source ?? "storage",
      storage_path: path,
      content_length: text.length,
      content: text,
    });
  },
});

// get_people
mcp.tool("get_people", {
  description:
    "Lista as pessoas (founders/owners) de uma iniciativa, extraídas de " +
    "submissions.data.founders. v1: para submissions do tipo 'editais' ou " +
    "'interna' que usem o campo 'owner' em vez de founders, devolve uma " +
    "lista única com esse owner.",
  inputSchema: IdSchema,
  handler: async ({ id }, ctx) => {
    const sb = getSb(ctx);
    const { data: sub, error } = await sb
      .from("submissions")
      .select("id, project_name, type, data")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);
    if (!sub) {
      throw new RpcError(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        "Iniciativa não encontrada (ou sem permissão).",
      );
    }

    const data = (sub.data ?? {}) as Record<string, any>;
    const founders = Array.isArray(data.founders) ? data.founders : [];
    const ownerObj = data.owner && typeof data.owner === "object" ? data.owner : null;

    const people = founders
      .filter((f: any) => f && typeof f === "object" && typeof f.name === "string" && f.name.trim().length > 0)
      .map((f: any) => ({
        name: String(f.name).trim(),
        role: "founder",
        title: f.title ? String(f.title) : null,
        is_founder: true,
        confirmed: true,
        city: f.city ? String(f.city) : null,
        linkedin: f.linkedin ? String(f.linkedin) : null,
      }));

    // Fallback: owner do submission (editais/interna) entra como pessoa única
    if (people.length === 0 && ownerObj && typeof ownerObj.name === "string") {
      people.push({
        name: String(ownerObj.name).trim(),
        role: "owner",
        title: ownerObj.title ? String(ownerObj.title) : null,
        is_founder: false,
        confirmed: true,
        city: ownerObj.city ? String(ownerObj.city) : null,
        linkedin: ownerObj.linkedin ? String(ownerObj.linkedin) : null,
      });
    }

    return textResult({ initiative_id: sub.id, people });
  },
});

// get_updates — feed consolidado de UMA iniciativa
mcp.tool("get_updates", {
  description:
    "Feed consolidado de eventos de uma iniciativa: meeting, status, " +
    "scorecard, vesting, ongoing. Source 'edit' não é suportada v1 " +
    "(sem audit log de edição de campos). Ordenado desc por occurred_at.",
  inputSchema: z.object({
    id: z.string().uuid(),
    since: z.string().datetime().optional(),
    sources: z.array(z.enum(["meeting", "status", "scorecard", "vesting", "ongoing", "edit"])).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  handler: async ({ id, since, sources, limit }, ctx) => {
    const sb = getSb(ctx);
    const { data: sub, error } = await sb
      .from("submissions")
      .select("id, project_name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);
    if (!sub) {
      throw new RpcError(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        "Iniciativa não encontrada (ou sem permissão).",
      );
    }
    // Filtra "edit" do array (não suportada) sem reclamar — agente pode mandar
    const effectiveSources = sources?.filter((s) => s !== "edit") as
      | UpdateSource[]
      | undefined;
    const { updates, blockers } = await collectUpdatesForInitiative(
      sb,
      sub.id,
      sub.project_name,
      { since, sources: effectiveSources, limit },
    );
    const openBlockers = blockers.filter((b) => b.status === "open");
    return textResult({
      initiative_id: sub.id,
      initiative_name: sub.project_name,
      since: since ?? null,
      updates,
      attention_points: openBlockers.map((b) => `[${b.severity}] ${b.description}`),
    });
  },
});

// get_updates_digest — agregação cross-projeto (gatilho semanal)
mcp.tool("get_updates_digest", {
  description:
    "Digest cross-projeto. Lista iniciativas (filtros opcionais status/type) " +
    "e, para cada uma, devolve updates + attention_points + counts. " +
    "Sem 'since', usa últimos 7 dias.",
  inputSchema: z.object({
    since: z.string().datetime().optional(),
    status: z.string().optional(),
    type: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  handler: async (input, ctx) => {
    const sb = getSb(ctx);
    // Default: últimos 7 dias. Como Date.now() pode ser sensível em runtime
    // determinístico, calculamos no momento da chamada.
    const since = input.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const limit = input.limit ?? 50;

    let q = sb
      .from("submissions")
      .select("id, project_name, status, type")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (input.status) q = q.eq("status", input.status);
    if (input.type) q = q.eq("type", input.type);

    const { data: subs, error } = await q;
    if (error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, error.message);

    const initiatives: Array<{
      initiative_id: string;
      initiative_name: string;
      status: string;
      updates: UpdateItem[];
      attention_points: string[];
      counts: { updates: number; open_blockers: number };
    }> = [];
    let totalOpenBlockers = 0;
    let withActivity = 0;
    let silent = 0;

    for (const s of subs ?? []) {
      const { updates, blockers } = await collectUpdatesForInitiative(
        sb,
        s.id,
        s.project_name,
        { since },
      );
      const open = blockers.filter((b) => b.status === "open");
      totalOpenBlockers += open.length;
      if (updates.length > 0) withActivity++;
      else silent++;
      initiatives.push({
        initiative_id: s.id,
        initiative_name: s.project_name,
        status: s.status,
        updates,
        attention_points: open.map((b) => `[${b.severity}] ${b.description}`),
        counts: { updates: updates.length, open_blockers: open.length },
      });
    }

    return textResult({
      since,
      generated_at: new Date().toISOString(),
      initiatives,
      totals: {
        initiatives_with_activity: withActivity,
        initiatives_silent: silent,
        open_blockers: totalOpenBlockers,
      },
    });
  },
});

// list_blockers — feed de bloqueios (escopo: uma iniciativa ou todas)
mcp.tool("list_blockers", {
  description:
    "Lista bloqueios/riscos extraídos das atas estruturadas " +
    "(meetings.minutes_structured.bloqueios_riscos). v1: todos com status " +
    "'open' (sem tabela de resolução); owner/due_date sempre null (não " +
    "capturados no schema do Volund).",
  inputSchema: z.object({
    id: z.string().uuid().optional(),
    status: z.enum(["open", "resolved"]).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    since: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  handler: async (input, ctx) => {
    const sb = getSb(ctx);
    const scope: "single" | "all" = input.id ? "single" : "all";

    // Iniciativas no escopo
    let subQ = sb.from("submissions").select("id, project_name");
    if (input.id) subQ = subQ.eq("id", input.id);
    const { data: subs, error: subErr } = await subQ;
    if (subErr) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, subErr.message);
    if (input.id && (!subs || subs.length === 0)) {
      throw new RpcError(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        "Iniciativa não encontrada (ou sem permissão).",
      );
    }
    const subMap = new Map<string, string>();
    for (const s of subs ?? []) subMap.set(s.id, s.project_name);

    if (subMap.size === 0) {
      return textResult({
        scope,
        filters: {
          status: input.status ?? null,
          severity: input.severity ?? null,
          since: input.since ?? null,
        },
        blockers: [],
        total: 0,
      });
    }

    // Meetings (com filtro temporal opcional)
    let mq = sb
      .from("meetings")
      .select("id, submission_id, meeting_date, minutes_structured, created_at")
      .in("submission_id", Array.from(subMap.keys()))
      .order("meeting_date", { ascending: false });
    if (input.since) mq = mq.gte("meeting_date", input.since);
    const { data: meetings, error: mErr } = await mq;
    if (mErr) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, mErr.message);

    let blockers: BlockerItem[] = [];
    for (const m of meetings ?? []) {
      const name = subMap.get(m.submission_id) ?? "";
      blockers.push(...extractBlockersFromMeeting(m, m.submission_id, name));
    }

    // Filtros (status sempre é "open" v1 — filtro "resolved" devolve vazio)
    if (input.severity) blockers = blockers.filter((b) => b.severity === input.severity);
    if (input.status) blockers = blockers.filter((b) => b.status === input.status);

    // Ordena: severity desc, raised_at desc
    blockers.sort((a, b) => {
      const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (r !== 0) return r;
      return (b.raised_at ?? "").localeCompare(a.raised_at ?? "");
    });

    const total = blockers.length;
    if (input.limit) blockers = blockers.slice(0, input.limit);

    return textResult({
      scope,
      filters: {
        status: input.status ?? null,
        severity: input.severity ?? null,
        since: input.since ?? null,
      },
      blockers,
      total,
    });
  },
});

// get_ongoing
mcp.tool("get_ongoing", {
  description: "Semanas (ongoing_weeks) e documentos (week_documents) da fase Ongoing.",
  inputSchema: IdSchema,
  handler: async ({ id }, ctx) => {
    const sb = getSb(ctx);
    const [weeks, docs] = await Promise.all([
      sb.from("ongoing_weeks").select("*").eq("submission_id", id)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      sb.from("week_documents").select("*").eq("submission_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (weeks.error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, weeks.error.message);
    if (docs.error) throw new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, docs.error.message);
    return textResult({ weeks: weeks.data ?? [], documents: docs.data ?? [] });
  },
});

// ─── HTTP transport ────────────────────────────────────────────────────────

const transport = new StreamableHttpTransport();
const mcpHandler = transport.bind(mcp);

const app = new Hono();

app.options("*", (c) => c.body(null, 204, corsHeaders));

app.get("/initiative-mcp", (c) =>
  c.json(
    {
      name: "aurora-initiative-mcp",
      version: "0.1.0",
      description: "MCP server (read-only) for Aurora initiatives. POST JSON-RPC com Bearer JWT.",
      tools: [
        "list_initiatives",
        "get_initiative",
        "get_people",
        "get_meetings",
        "get_transcript",
        "get_scorecard",
        "get_vesting",
        "get_history",
        "get_ongoing",
        "get_updates",
        "get_updates_digest",
        "list_blockers",
      ],
    },
    200,
    corsHeaders,
  ));

app.get("/", (c) =>
  c.json(
    {
      name: "aurora-initiative-mcp",
      version: "0.1.0",
      description: "MCP server (read-only) for Aurora initiatives. POST JSON-RPC com Bearer JWT.",
      tools: [
        "list_initiatives",
        "get_initiative",
        "get_people",
        "get_meetings",
        "get_transcript",
        "get_scorecard",
        "get_vesting",
        "get_history",
        "get_ongoing",
        "get_updates",
        "get_updates_digest",
        "list_blockers",
      ],
    },
    200,
    corsHeaders,
  ));

app.all("*", async (c) => {
  try {
    const token = getBearerToken(c.req.raw);
    const rawBody = c.req.method === "POST" ? await c.req.raw.clone().text() : "";
    let rpcMethod: string | undefined;
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed && typeof parsed === "object" && "method" in parsed && typeof parsed.method === "string") {
          rpcMethod = parsed.method;
        }
      } catch {
        rpcMethod = undefined;
      }
    }
    // Identifica o modo de auth para auditoria (sem expor o token).
    let authMode: "service" | "user" | "anonymous" = "anonymous";
    if (token) {
      authMode = MCP_AGENT_API_KEY && timingSafeEqual(token, MCP_AGENT_API_KEY)
        ? "service"
        : "user";
    }
    // Extrai o nome da tool quando for tools/call, para auditoria por tool.
    let toolName: string | undefined;
    if (rpcMethod === "tools/call" && rawBody) {
      try {
        const parsed = JSON.parse(rawBody);
        toolName = parsed?.params?.name;
      } catch { /* ignore */ }
    }
    console.log(JSON.stringify({
      route: "initiative-mcp",
      httpMethod: c.req.method,
      rpcMethod,
      toolName,
      authMode,
    }));
    const resp = await mcpHandler(c.req.raw, token ? { authInfo: { token, scopes: [] } } : undefined);
    const merged = new Headers(resp.headers);
    for (const [k, v] of Object.entries(corsHeaders)) merged.set(k, v);
    return new Response(resp.body, { status: resp.status, headers: merged });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
      corsHeaders,
    );
  }
});

Deno.serve(app.fetch);
