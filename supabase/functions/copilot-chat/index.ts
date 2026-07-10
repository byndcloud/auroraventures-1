// ============================================================================
// Edge Function: copilot-chat
// ============================================================================
// Orquestrador do chat do co-pilot da Aurora.
//
// IMPORTANTE: o Volund OS não suporta tools/function calling. Então a Aurora
// monta o contexto completo da iniciativa (snapshot) ANTES de chamar o agente
// e envia tudo no campo `input` do Volund. O agente lê o contexto + a
// pergunta do usuário e responde em linguagem natural.
//
// Modo síncrono: chamada sem callback_url, resposta vem direto.
//
// Input (POST JSON):
// {
//   submissionId: string,
//   sessionId?: string,
//   message: string
// }
//
// Output (200 JSON):
// {
//   sessionId: string,
//   userMessage:      { id, content, created_at },
//   assistantMessage: { id, content, created_at },
//   runId: string
// }
//
// Variáveis de ambiente:
//   VOLUND_API_KEY            — chave de API do Volund OS
//   VOLUND_COPILOT_AGENT_ID   — ID do agente Co-Pilot no Volund
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  submissionId: string;
  sessionId?: string;
  message: string;
}

const MAX_MEETINGS_IN_CONTEXT = 30;
const MAX_DOCUMENTS_IN_CONTEXT = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VOLUND_API_KEY = Deno.env.get("VOLUND_API_KEY");
    const VOLUND_COPILOT_AGENT_ID = Deno.env.get("VOLUND_COPILOT_AGENT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!VOLUND_API_KEY || !VOLUND_COPILOT_AGENT_ID) {
      return json({ error: "Missing Volund Co-Pilot secrets" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const [{ data: isAdmin }, { data: isColab }] = await Promise.all([
      userClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      userClient.rpc("has_role", { _user_id: user.id, _role: "colaborador" }),
    ]);
    if (!isAdmin && !isColab) return json({ error: "Forbidden" }, 403);

    const body: RequestBody = await req.json();
    if (!body.submissionId || !body.message?.trim()) {
      return json({ error: "submissionId and message required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Obtém ou cria sessão
    let sessionId = body.sessionId;
    let existingRunId: string | null = null;

    if (sessionId) {
      const { data: session } = await admin
        .from("chat_sessions")
        .select("id, volund_run_id, user_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session || session.user_id !== user.id) {
        return json({ error: "Session not found" }, 404);
      }
      existingRunId = session.volund_run_id;
    } else {
      const { data: newSession, error: createErr } = await admin
        .from("chat_sessions")
        .insert({
          submission_id: body.submissionId,
          user_id: user.id,
          title: body.message.slice(0, 80),
        })
        .select("id")
        .single();
      if (createErr || !newSession) {
        return json(
          { error: "Could not create session", detail: createErr?.message },
          500,
        );
      }
      sessionId = newSession.id;
    }

    // 2) Salva mensagem do usuário
    const { data: userMessage, error: userMsgErr } = await admin
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        role: "user",
        content: body.message.trim(),
      })
      .select("id, content, created_at")
      .single();
    if (userMsgErr) return json({ error: "Could not save user message" }, 500);

    // 3) Monta contexto da iniciativa (snapshot)
    //    Numa primeira mensagem da sessão: contexto completo.
    //    Nas seguintes: o Volund já tem a thread, mandamos só a pergunta nova.
    let promptInput: string;
    if (existingRunId) {
      // Continua a thread — só a nova pergunta
      promptInput = body.message.trim();
    } else {
      const context = await buildContext(admin, body.submissionId);
      promptInput = formatInitialPrompt(context, body.message.trim());
    }

    // 4) Chama o Volund (síncrono)
    let volundResp: Response;
    if (existingRunId) {
      volundResp = await fetch(
        `https://os.volund.com.br/api/v1/runs/${existingRunId}/continue`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VOLUND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: promptInput }),
        },
      );
    } else {
      volundResp = await fetch(
        `https://os.volund.com.br/api/v1/agents/${VOLUND_COPILOT_AGENT_ID}/run`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VOLUND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: promptInput }),
        },
      );
    }

    if (!volundResp.ok) {
      const errText = await volundResp.text();
      return json(
        { error: `Volund ${volundResp.status}: ${errText.slice(0, 500)}` },
        502,
      );
    }

    const volundData = await volundResp.json();
    const finalOutput: string =
      volundData.output ?? "(O agente respondeu vazio.)";
    const runId: string = volundData.run_id ?? existingRunId ?? "";

    // 5) Atualiza session com volund_run_id (1ª vez)
    if (!existingRunId && runId) {
      await admin
        .from("chat_sessions")
        .update({ volund_run_id: runId })
        .eq("id", sessionId);
    }

    // 6) Salva resposta do assistente
    const { data: assistantMessage, error: assistantErr } = await admin
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        content: finalOutput,
        metadata: { run_id: runId, usage: volundData.usage ?? null },
      })
      .select("id, content, created_at")
      .single();
    if (assistantErr) return json({ error: "Could not save assistant message" }, 500);

    return json(
      {
        sessionId,
        userMessage,
        assistantMessage,
        // Campo `assistant` mantido para compatibilidade com a versão anterior
        // do Edge Function (que retornava só { sessionId, assistant }).
        assistant: finalOutput,
        runId,
      },
      200,
    );
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    );
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────

async function buildContext(admin: any, submissionId: string) {
  // Em paralelo: submission + score + meetings + documents + weeks
  const [
    submissionRes,
    scoreRes,
    meetingsRes,
    docsRes,
    weeksRes,
  ] = await Promise.all([
    admin.from("submissions").select("*").eq("id", submissionId).maybeSingle(),
    admin
      .from("evaluations")
      .select("*")
      .eq("submission_id", submissionId)
      .eq("processing_status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("meetings")
      .select(
        "id, title, meeting_date, category, week_id, minutes_structured, smart_minutes, processing_status",
      )
      .eq("submission_id", submissionId)
      .order("meeting_date", { ascending: false })
      .limit(MAX_MEETINGS_IN_CONTEXT),
    admin
      .from("week_documents")
      .select("id, week_id, file_name, file_size, mime_type, created_at")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(MAX_DOCUMENTS_IN_CONTEXT),
    admin
      .from("ongoing_weeks")
      .select("id, title, created_at")
      .eq("submission_id", submissionId)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  return {
    submission: submissionRes.data,
    latestScore: scoreRes.data,
    meetings: meetingsRes.data ?? [],
    documents: docsRes.data ?? [],
    weeks: weeksRes.data ?? [],
  };
}

function formatInitialPrompt(ctx: any, userMessage: string): string {
  const sub = ctx.submission;
  if (!sub) {
    return `INICIATIVA NÃO ENCONTRADA.\n\nPERGUNTA DO USUÁRIO:\n${userMessage}`;
  }

  const parts: string[] = [];

  // Dados da iniciativa
  parts.push("### DADOS DA INICIATIVA");
  parts.push(`Nome: ${sub.project_name ?? "(sem nome)"}`);
  parts.push(`Tipo de origem: ${sub.type ?? "—"}`);
  parts.push(`Status atual: ${sub.status ?? "—"}`);
  if (sub.due_date) parts.push(`Prazo: ${sub.due_date}`);
  if (sub.briefing) parts.push(`Briefing: ${sub.briefing}`);
  if (sub.data) {
    parts.push("\nCampos do formulário de submissão:");
    parts.push(JSON.stringify(sub.data, null, 2));
  }

  // Scorecard
  if (ctx.latestScore) {
    parts.push("\n### SCORECARD (mais recente)");
    parts.push(`Nota final: ${ctx.latestScore.final_score ?? "—"}`);
    parts.push(`Veredicto: ${ctx.latestScore.verdict ?? "—"}`);
    if (ctx.latestScore.has_veto) parts.push("⚠️ Tem veto marcado.");
    if (ctx.latestScore.scores) {
      parts.push("Critérios:");
      parts.push(JSON.stringify(ctx.latestScore.scores, null, 2));
    }
  }

  // Semanas
  if (ctx.weeks.length > 0) {
    parts.push("\n### SEMANAS (fase Ongoing)");
    ctx.weeks.forEach((w: any) => {
      parts.push(`- ${w.title} (id: ${w.id}, criada em ${w.created_at?.slice(0, 10)})`);
    });
  }

  // Reuniões
  if (ctx.meetings.length > 0) {
    parts.push(`\n### REUNIÕES (últimas ${ctx.meetings.length})`);
    ctx.meetings.forEach((m: any) => {
      const date = m.meeting_date?.slice(0, 10) ?? "";
      const cat = m.category === "ongoing" ? " [Ongoing]" : "";
      parts.push(`\n— ${m.title}${cat} · ${date}`);
      const ms = m.minutes_structured;
      if (ms) {
        if (ms.resumo_executivo) {
          parts.push(`  Resumo: ${ms.resumo_executivo}`);
        }
        if (Array.isArray(ms.decisoes) && ms.decisoes.length > 0) {
          parts.push("  Decisões:");
          ms.decisoes.slice(0, 5).forEach((d: any) => {
            parts.push(`    • ${d.descricao}`);
          });
        }
        if (Array.isArray(ms.proximos_passos) && ms.proximos_passos.length > 0) {
          parts.push("  Próximos passos:");
          ms.proximos_passos.slice(0, 5).forEach((p: any) => {
            const resp = p.responsavel ? ` (resp: ${p.responsavel})` : "";
            const prazo = p.prazo ? ` [${p.prazo}]` : "";
            parts.push(`    • ${p.descricao}${resp}${prazo}`);
          });
        }
        if (Array.isArray(ms.bloqueios_riscos) && ms.bloqueios_riscos.length > 0) {
          parts.push("  Bloqueios/riscos:");
          ms.bloqueios_riscos.slice(0, 5).forEach((b: any) => {
            parts.push(`    • [${b.severidade ?? "—"}] ${b.descricao}`);
          });
        }
        if (Array.isArray(ms.metricas_mencionadas) && ms.metricas_mencionadas.length > 0) {
          parts.push("  Métricas:");
          ms.metricas_mencionadas.slice(0, 5).forEach((mm: any) => {
            parts.push(`    • ${mm.metrica}: ${mm.valor}`);
          });
        }
      } else if (m.smart_minutes) {
        // Ata markdown legada — truncar
        const trimmed = String(m.smart_minutes).slice(0, 800);
        parts.push(`  (Ata legada) ${trimmed}${trimmed.length === 800 ? "…" : ""}`);
      } else if (m.processing_status) {
        parts.push(`  (Status: ${m.processing_status})`);
      }
    });
  }

  // Documentos
  if (ctx.documents.length > 0) {
    parts.push("\n### DOCUMENTOS ANEXADOS");
    ctx.documents.forEach((d: any) => {
      const kb = d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "";
      parts.push(`- ${d.file_name} (${kb})`);
    });
    parts.push(
      "(Nota: o conteúdo dos documentos ainda não é lido pela IA, apenas os nomes.)",
    );
  }

  parts.push("\n### PERGUNTA DO USUÁRIO");
  parts.push(userMessage);

  parts.push(
    "\n### INSTRUÇÕES",
    "Responda em português, de forma clara e concisa, baseando-se",
    "exclusivamente nos dados acima. Se a informação não estiver",
    "disponível, diga isso explicitamente.",
  );

  return parts.join("\n");
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
