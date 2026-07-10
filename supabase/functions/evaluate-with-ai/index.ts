// ============================================================================
// Edge Function: evaluate-with-ai
// ============================================================================
// Dispara o agente Avaliador Aurora no Volund OS para gerar uma avaliação
// completa de scorecard a partir dos dados de uma submission + todas as
// reuniões atreladas a ela. O callback (volund-evaluation-callback) recebe
// o JSON estruturado e persiste em `evaluations`.
//
// Input (POST JSON, JWT obrigatório, admin only):
//   { submissionId: string }
//
// Output (200 JSON):
//   { evaluationId: string, runId: string | null }
//
// Variáveis de ambiente:
//   VOLUND_API_KEY               — Bearer token Volund
//   VOLUND_EVALUATION_AGENT_ID   — ID do agente Avaliador (skill V1)
//   VOLUND_CALLBACK_SECRET       — segredo HMAC compartilhado com callbacks
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { hmacSign } from "../_shared/hmac.ts";

const INSTRUCTION = `Avalie a iniciativa seguindo o skill "Avaliador de Startups — Aurora V1".

O payload de input (no formato definido no skill, contendo "submission" e "meetings") está INLINE neste mesmo prompt, logo abaixo, entre os marcadores <PAYLOAD> e </PAYLOAD>. NÃO há arquivos anexados — todos os dados estão no JSON abaixo.

Retorne EXCLUSIVAMENTE o JSON estruturado definido no contrato de output da skill (scores, vetos, descriptions, report, summary, verdict_hint). Sem markdown, sem cercas \`\`\`, sem texto fora do JSON.

<PAYLOAD>`;

const INSTRUCTION_FOOTER = `</PAYLOAD>`;

interface RequestBody {
  submissionId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VOLUND_API_KEY = Deno.env.get("VOLUND_API_KEY");
    const AGENT_ID = Deno.env.get("VOLUND_EVALUATION_AGENT_ID");
    const CALLBACK_SECRET = Deno.env.get("VOLUND_CALLBACK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!VOLUND_API_KEY || !AGENT_ID || !CALLBACK_SECRET) {
      return json({ error: "Missing Volund secrets" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body: RequestBody = await req.json();
    if (!body.submissionId) {
      return json({ error: "submissionId required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Busca submission
    const { data: submission, error: subErr } = await admin
      .from("submissions")
      .select("id, type, project_name, data, briefing, created_at")
      .eq("id", body.submissionId)
      .maybeSingle();

    if (subErr || !submission) {
      return json({ error: "Submission not found" }, 404);
    }

    // 2) Busca todas as reuniões da submission
    const { data: meetings } = await admin
      .from("meetings")
      .select(
        "id, title, meeting_date, pre_agenda, smart_minutes, minutes_structured, transcript",
      )
      .eq("submission_id", body.submissionId)
      .order("meeting_date", { ascending: true });

    // 3) Monta envelope no formato esperado pelo skill V1
    const envelope = {
      submission,
      meetings: meetings ?? [],
    };

    // 4) Cria a linha de evaluation (processing) ANTES de chamar Volund — o
    //    evaluationId vira o identificador usado no HMAC do callback.
    const { data: evaluation, error: evalErr } = await admin
      .from("evaluations")
      .insert({
        submission_id: body.submissionId,
        author_id: user.id,
        source: "ai",
        processing_status: "processing",
        scores: {},
      })
      .select("id")
      .single();

    if (evalErr || !evaluation) {
      return json({ error: "Evaluation insert failed", detail: evalErr?.message }, 500);
    }

    // 5) Token HMAC com o evaluationId
    const token = await hmacSign(evaluation.id, CALLBACK_SECRET);
    const callbackUrl = `${SUPABASE_URL}/functions/v1/volund-evaluation-callback?evaluation=${evaluation.id}&token=${token}`;

    // 6) Dispara o agente Volund (assíncrono via callback_url)
    const volundResp = await fetch(
      `https://os.volund.com.br/api/v1/agents/${AGENT_ID}/run`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VOLUND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: `${INSTRUCTION}\n${JSON.stringify(envelope)}\n${INSTRUCTION_FOOTER}`,
          callback_url: callbackUrl,
        }),
      },
    );

    if (!volundResp.ok) {
      const errText = await volundResp.text();
      await admin
        .from("evaluations")
        .update({
          processing_status: "failed",
          error_message: `Volund ${volundResp.status}: ${errText.slice(0, 500)}`,
        })
        .eq("id", evaluation.id);
      return json(
        { error: `Volund ${volundResp.status}`, evaluationId: evaluation.id },
        502,
      );
    }

    const volundData = await volundResp.json();

    await admin
      .from("evaluations")
      .update({ volund_run_id: volundData.run_id ?? null })
      .eq("id", evaluation.id);

    return json(
      { evaluationId: evaluation.id, runId: volundData.run_id ?? null },
      200,
    );
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
