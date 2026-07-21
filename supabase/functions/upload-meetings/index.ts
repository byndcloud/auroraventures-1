// ============================================================================
// Edge Function: upload-meetings
// ============================================================================
// Recebe uma lista de arquivos já enviados ao Storage pelo frontend e, para
// cada um, cria um registro em `meetings`, gera signed URL e dispara o agente
// no Volund OS com callback_url protegido por HMAC.
//
// Input (POST JSON):
// {
//   submissionId: string,           // FK para submissions
//   files: [{
//     fileName: string,             // ex: "weekly_zelar_2026-06-06.txt"
//     storagePath: string,          // ex: "<submissionId>/<uuid>-weekly.txt"
//   }]
// }
//
// Output (200 JSON):
// { meetingIds: string[] }
//
// Variáveis de ambiente necessárias:
//   VOLUND_API_KEY           — chave da API do Volund OS
//   VOLUND_AGENT_ID          — ID do agente que gera atas
//   VOLUND_CALLBACK_SECRET   — segredo para HMAC do callback_url
//   SUPABASE_URL             — provido pelo Supabase
//   SUPABASE_SERVICE_ROLE_KEY — provido pelo Supabase
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { hmacSign } from "../_shared/hmac.ts";

const PROMPT_GERAR_ATA = `Analise a transcrição da reunião em anexo e gere uma ata estruturada.

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem cercas \`\`\`) com os campos:

{
  "titulo_sugerido": "string (5-10 palavras, contextual)",
  "data_reuniao": "YYYY-MM-DD ou null",
  "participantes": ["nome1", "nome2"],
  "resumo_executivo": "string (3-5 linhas)",
  "topicos_discutidos": [{ "titulo": "string", "detalhes": "string" }],
  "decisoes": [{ "descricao": "string", "tomada_por": "string|null", "contexto": "string" }],
  "proximos_passos": [{ "descricao": "string", "responsavel": "string|null", "prazo": "string|null" }],
  "bloqueios_riscos": [{ "descricao": "string", "severidade": "baixa|media|alta" }],
  "metricas_mencionadas": [{ "metrica": "string", "valor": "string", "contexto": "string" }],
  "sentimento_geral": { "score": 1, "justificativa": "string" }
}

Regras:
- Não invente. Se algo não foi discutido, retorne array vazio ou null.
- Extraia responsáveis e prazos apenas quando mencionados explicitamente.
- Use português do Brasil.`;

interface FilePayload {
  fileName: string;
  storagePath: string;
  // Opcionais: se ausentes, o backend usa fallback (nome do arquivo / now())
  title?: string;
  meetingDate?: string; // ISO 8601
}

interface RequestBody {
  submissionId: string;
  files: FilePayload[];
  // Categoria das reuniões deste batch — vale para todos os arquivos.
  // 'general' = aba Reuniões (default). 'ongoing' = aba Ongoing.
  category?: "general" | "ongoing";
  // Quando informado, todas as meetings deste batch ficam vinculadas a esta
  // semana (usado pela aba Ongoing).
  weekId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VOLUND_API_KEY = Deno.env.get("VOLUND_API_KEY");
    const VOLUND_AGENT_ID = Deno.env.get("VOLUND_AGENT_ID");
    const CALLBACK_SECRET = Deno.env.get("VOLUND_CALLBACK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!VOLUND_API_KEY || !VOLUND_AGENT_ID || !CALLBACK_SECRET) {
      return json({ error: "Missing Volund secrets" }, 500);
    }

    // userClient com ANON_KEY: RLS aplica sobre o JWT do usuário; nenhum
    // bypass acidental. `admin` (service_role) usado somente nas mutações
    // privilegiadas (Storage signed URL + meetings INSERT/UPDATE).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Verifica que é admin (defesa em profundidade — RLS já protege a tabela)
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body: RequestBody = await req.json();
    if (!body.submissionId || !Array.isArray(body.files) || body.files.length === 0) {
      return json({ error: "submissionId and files[] required" }, 400);
    }
    if (body.files.length > 10) {
      return json({ error: "Max 10 files per request" }, 400);
    }
    const category: "general" | "ongoing" =
      body.category === "ongoing" ? "ongoing" : "general";

    // Cliente service-role para mutações privilegiadas
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const meetingIds: string[] = [];
    const errors: { fileName: string; error: string }[] = [];

    // Processa cada arquivo em sequência (pode paralelizar com Promise.all se desejar)
    for (const file of body.files) {
      try {
        // 1) Signed URL de 1h para o Volund baixar o arquivo
        const { data: signed, error: signErr } = await admin.storage
          .from("transcripts")
          .createSignedUrl(file.storagePath, 3600);
        if (signErr || !signed) {
          errors.push({ fileName: file.fileName, error: "Storage signed URL failed" });
          continue;
        }

        // 2) Cria meeting (status='queued')
        //    Usa title/meetingDate do payload se vierem; caso contrário usa
        //    fallback (nome do arquivo sem extensão / agora).
        const titleToUse =
          (file.title && file.title.trim()) ||
          file.fileName.replace(/\.[^.]+$/, "");
        const meetingDateToUse = file.meetingDate ?? new Date().toISOString();

        const { data: meeting, error: insertErr } = await admin
          .from("meetings")
          .insert({
            submission_id: body.submissionId,
            title: titleToUse,
            meeting_date: meetingDateToUse,
            // transcript_path é a fonte de verdade (a signed URL expira em 1h
            // e fica gravada apenas como conveniência/debug)
            transcript_path: file.storagePath,
            transcript_url: signed.signedUrl,
            source: "volund_upload",
            processing_status: "queued",
            category,
            week_id: body.weekId ?? null,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (insertErr || !meeting) {
          errors.push({ fileName: file.fileName, error: "Meeting insert failed" });
          continue;
        }

        // 3) Token HMAC para validar o callback
        const token = await hmacSign(meeting.id, CALLBACK_SECRET);
        const callbackUrl = `${SUPABASE_URL}/functions/v1/volund-callback?meeting=${meeting.id}&token=${token}`;

        // 4) Dispara o Volund
        const volundResp = await fetch(
          `https://os.volund.com.br/api/v1/agents/${VOLUND_AGENT_ID}/run`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${VOLUND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: PROMPT_GERAR_ATA,
              files: [{ url: signed.signedUrl }],
              callback_url: callbackUrl,
            }),
          },
        );

        if (!volundResp.ok) {
          const errText = await volundResp.text();
          await admin
            .from("meetings")
            .update({
              processing_status: "failed",
              error_message: `Volund ${volundResp.status}: ${errText.slice(0, 500)}`,
            })
            .eq("id", meeting.id);
          errors.push({ fileName: file.fileName, error: `Volund ${volundResp.status}` });
          meetingIds.push(meeting.id);
          continue;
        }

        const volundData = await volundResp.json();

        // 5) Salva run_id e marca como 'processing'
        await admin
          .from("meetings")
          .update({
            volund_run_id: volundData.run_id ?? null,
            processing_status: "processing",
          })
          .eq("id", meeting.id);

        meetingIds.push(meeting.id);
      } catch (err) {
        errors.push({
          fileName: file.fileName,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return json({ meetingIds, errors }, 200);
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
