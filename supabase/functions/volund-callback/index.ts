// ============================================================================
// Edge Function: volund-callback
// ============================================================================
// Recebe o webhook do Volund OS quando um run termina (ou falha) e popula
// `meetings.minutes_structured` com a ata estruturada.
//
// O Volund chama:
//   POST {SUPABASE_URL}/functions/v1/volund-callback?meeting=<uuid>&token=<hmac>
//
// Body do Volund:
// {
//   run_id: string,
//   status: "completed" | "failed" | ...,
//   output: string | object,   // idealmente JSON estruturado (vide prompt)
//   ...
// }
//
// Segurança: o `token` é HMAC-SHA256(meeting_id, VOLUND_CALLBACK_SECRET).
// Sem token válido, retorna 403.
//
// Idempotência: callbacks duplicados não sobrescrevem registros já completos.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { hmacSign, safeEquals } from "../_shared/hmac.ts";

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
    const meetingId = url.searchParams.get("meeting");
    const token = url.searchParams.get("token");

    if (!meetingId || !token) {
      return json({ error: "Missing meeting or token" }, 400);
    }

    // 1) Valida HMAC do callback
    const expected = await hmacSign(meetingId, CALLBACK_SECRET);
    if (!safeEquals(expected, token)) {
      return json({ error: "Invalid token" }, 403);
    }

    const payload: VolundCallbackBody = await req.json();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 2) Idempotência: se já está completed, ignora
    const { data: current } = await admin
      .from("meetings")
      .select("processing_status")
      .eq("id", meetingId)
      .maybeSingle();

    if (!current) return json({ error: "Meeting not found" }, 404);
    if (current.processing_status === "completed") {
      return json({ ok: true, skipped: "already_completed" }, 200);
    }

    // 3) Status diferente de completed -> marca failed
    if (payload.status !== "completed") {
      await admin
        .from("meetings")
        .update({
          processing_status: "failed",
          error_message: payload.error ??
            `Volund returned status=${payload.status ?? "unknown"}`,
          processed_at: new Date().toISOString(),
        })
        .eq("id", meetingId);
      return json({ ok: true, status: "failed" }, 200);
    }

    // 4) Parseia o output (JSON estruturado)
    let structured: unknown = null;
    const raw = payload.output;
    if (raw == null) {
      structured = { resumo_executivo: "(Volund retornou output vazio)" };
    } else if (typeof raw === "object") {
      structured = raw;
    } else if (typeof raw === "string") {
      try {
        structured = JSON.parse(raw);
      } catch {
        // Fallback: tenta extrair JSON entre cercas de código (caso o agente
        // tenha enviado markdown apesar do prompt). Se falhar de novo, salva
        // como resumo bruto para não perder o conteúdo.
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          try {
            structured = JSON.parse(match[1]);
          } catch {
            structured = { resumo_executivo: raw };
          }
        } else {
          structured = { resumo_executivo: raw };
        }
      }
    }

    // 5) Persiste
    const { error: updateErr } = await admin
      .from("meetings")
      .update({
        minutes_structured: structured,
        processing_status: "completed",
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", meetingId);

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
