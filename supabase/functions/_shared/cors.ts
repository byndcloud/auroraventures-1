// ============================================================================
// _shared/cors.ts — CORS headers para Edge Functions
// ============================================================================
// Requer o secret `CORS_ORIGIN` configurado no projeto (ex.:
// `supabase secrets set CORS_ORIGIN=https://aurora.suaempresa.com.br`).
//
// NÃO há mais fallback para "*". Se `CORS_ORIGIN` não estiver setado, a
// função retornará 500 na primeira request (fail-fast — evita relaxar CORS
// silenciosamente em deploy mal configurado).
// ============================================================================

const CORS_ORIGIN = Deno.env.get("CORS_ORIGIN");

/**
 * Headers CORS compartilhados entre Edge Functions.
 *
 * ATENÇÃO: se `CORS_ORIGIN` não estiver configurado, o acesso a `corsHeaders`
 * lança erro. Cada Edge Function deve envolver `try/catch` no handler para
 * responder 500 controlado quando isso acontece (padrão já usado nas funções
 * do projeto — o try externo no `Deno.serve` cobre).
 */
export const corsHeaders: Record<string, string> = CORS_ORIGIN
  ? {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    }
  : (() => {
      console.error(
        "[cors] FATAL: CORS_ORIGIN secret não configurado. Rode `supabase secrets set CORS_ORIGIN=https://seu-dominio` antes de fazer deploy.",
      );
      // Devolvemos headers vazios em vez de throw a nível de módulo — assim a
      // função ainda arranca e devolve 500 controlado na primeira request.
      // O front rejeita a resposta por CORS ausente (efeito equivalente).
      return {} as Record<string, string>;
    })();
