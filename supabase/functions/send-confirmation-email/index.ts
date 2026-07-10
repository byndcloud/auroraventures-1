// Edge Function: send-confirmation-email
//
// PRÉ-REQUISITOS (executar uma vez via CLI):
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//   supabase secrets set SITE_URL=https://seu-dominio.com
//   supabase functions deploy send-confirmation-email
//
// O campo `from` abaixo deve ser um domínio verificado no Resend.
// Troque "aurora@aurora.volund.com.br" pelo seu domínio verificado antes do deploy.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://aurora.volund.com.br";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TYPE_LABELS: Record<string, string> = {
  mercado: "Mercado",
  interna: "Iniciativa Interna",
  editais: "Editais",
};

const DASHBOARD_PATHS: Record<string, string> = {
  mercado: "/dashboard-founder",
  interna: "/dashboard-colaborador",
  editais: "/dashboard-colaborador",
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Require authenticated caller — prevents anonymous email relay/phishing.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { userEmail, userName, projectName, submissionType } = await req.json();

    if (!userEmail || !projectName || !submissionType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Caller may only send the confirmation email to themselves.
    if (String(userEmail).toLowerCase() !== String(authData.user.email ?? "").toLowerCase()) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawTypeLabel = TYPE_LABELS[submissionType] ?? submissionType;
    const dashboardUrl = `${SITE_URL}${DASHBOARD_PATHS[submissionType] ?? "/"}`;
    const rawDisplayName = userName || (userEmail as string).split("@")[0];
    const displayName = escapeHtml(rawDisplayName);
    const safeProjectName = escapeHtml(projectName);
    const typeLabel = escapeHtml(rawTypeLabel);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:12px;border:1px solid #1e1e2e;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.15em;color:#c4b5fd;text-transform:uppercase;">AURORA</p>
            <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;">Submissão Recebida</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#a1a1aa;">Olá, <strong style="color:#e4e4e7;">${displayName}</strong></p>
            <p style="margin:0 0 24px;font-size:15px;color:#a1a1aa;line-height:1.6;">
              Recebemos sua submissão com sucesso. Nossa equipe irá avaliar e entrar em contato em breve.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border-radius:8px;border:1px solid #1e1e2e;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#6d28d9;text-transform:uppercase;">Projeto</p>
                  <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#ffffff;">${safeProjectName}</p>
                  <p style="margin:0;font-size:12px;color:#52525b;">Tipo de chamada: <span style="color:#a1a1aa;">${typeLabel}</span></p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;">
                    Ver meu dashboard
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #1e1e2e;text-align:center;">
            <p style="margin:0;font-size:12px;color:#3f3f46;">
              AURORA · Plataforma de Inovação Beyond / Volund<br/>
              Este é um email automático. Não responda esta mensagem.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Aurora <aurora@aurora.volund.com.br>",
        to: [userEmail],
        subject: `✅ Recebemos sua submissão — ${projectName}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
