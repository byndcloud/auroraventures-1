// ============================================================================
// _shared/scorecard-schema.ts
// ============================================================================
// SOMENTE METADATA — sem matemática. A fórmula do scorecard é a função Postgres
// `public.compute_evaluation_verdict(scores, submission_type)`, disparada por
// trigger em `public.evaluations`. Front e Edge Functions apenas gravam
// `scores`; final_score/has_veto/verdict vêm do servidor.
//
// Este arquivo existe só para:
//   1. Enumerar as chaves reconhecidas em `scores` (para o normalizador do
//      volund-evaluation-callback saber o que ignorar).
//   2. Listar os vetos válidos por origem (para inicializar flags como false).
//
// Mudanças de peso/veto: alterar `supabase/migrations/20260720000100_compute_evaluation_verdict.sql`
// E o espelho em `src/components/admin/scorecard.ts` (metadata de UI).
// ============================================================================

export type Origin = "mercado" | "interna" | "editais";

interface FieldMeta {
  key: string;
  isVeto?: boolean;
}

export const BLOCO1_KEYS: FieldMeta[] = [
  { key: "diferencial" },
  { key: "alinhamento" },
  { key: "problemaReal" },
  { key: "tamSamSom" },
  { key: "escalaReceita" },
  { key: "escalaB2G" },
  { key: "infraAprov" },
  { key: "velocidadeMVP" },
  { key: "vibeCoding" },
  { key: "riscoRegulatorio", isVeto: true },
  { key: "conhecimentoInterno" },
  { key: "processoComercial" },
];

export const BLOCO2_KEYS: Record<Origin, FieldMeta[]> = {
  mercado: [
    { key: "perfilFounder", isVeto: true },
    { key: "donoBriga" },
    { key: "sinergiaCAC" },
    { key: "gapEntrega" },
    { key: "canaisVenda" },
  ],
  interna: [
    { key: "disponibilidadeReal", isVeto: true },
    { key: "perfilEmpreendedor", isVeto: true },
    { key: "donoBriga" },
    { key: "canaisNetwork" },
  ],
  editais: [
    { key: "pi", isVeto: true },
    { key: "cobertura" },
    { key: "matchRecursos" },
    { key: "atestados", isVeto: true },
    { key: "ecossistema" },
    { key: "fluxoCaixa" },
    { key: "roiBurocratico" },
  ],
};

export function vetoKeys(origin: Origin): string[] {
  return [...BLOCO1_KEYS, ...BLOCO2_KEYS[origin]]
    .filter((f) => f.isVeto)
    .map((f) => f.key);
}
