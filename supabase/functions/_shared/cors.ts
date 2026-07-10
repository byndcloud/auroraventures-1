// Headers CORS compartilhados entre Edge Functions.
// Defina o secret CORS_ORIGIN com o domínio do front em produção
// (ex.: https://aurora.suaempresa.com.br). Sem o secret, cai em "*" (dev).
export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
