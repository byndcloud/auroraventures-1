import { SubmissionOrigin } from "./common";

// Bloco 1 is the same for all origins
export const BLOCO1_FIELDS = [
  { key: "diferencial", label: "Diferencial Injusto", weight: 10 },
  { key: "alinhamento", label: "Alinhamento", weight: 10 },
  { key: "problemaReal", label: "Problema Real", weight: 10 },
  { key: "tamSamSom", label: "TAM/SAM/SOM", weight: 10 },
  { key: "escalaReceita", label: "Escala Receita/Custo", weight: 10 },
  { key: "escalaB2G", label: "Escala B2G", weight: 10 },
  { key: "infraAprov", label: "Aproveitamento Infra", weight: 5 },
  { key: "velocidadeMVP", label: "Velocidade MVP", weight: 10 },
  { key: "vibeCoding", label: "Vibe Coding", weight: 5 },
  { key: "riscoRegulatorio", label: "Risco Regulatório", weight: 10, isVeto: true },
  { key: "conhecimentoInterno", label: "Conhecimento Interno", weight: 5 },
  { key: "processoComercial", label: "Processo Comercial", weight: 5 },
];

// Bloco 2 varies by origin
export const BLOCO2_FIELDS: Record<SubmissionOrigin, { key: string; label: string; weight: number; isVeto?: boolean }[]> = {
  mercado: [
    { key: "perfilFounder", label: "Perfil do Founder", weight: 20, isVeto: true },
    { key: "donoBriga", label: "Dono da Briga", weight: 20 },
    { key: "sinergiaCAC", label: "Sinergia/CAC", weight: 20 },
    { key: "gapEntrega", label: "Gap de Entrega", weight: 20 },
    { key: "canaisVenda", label: "Canais de Venda", weight: 20 },
  ],
  interna: [
    { key: "disponibilidadeReal", label: "Disponibilidade Real", weight: 30, isVeto: true },
    { key: "perfilEmpreendedor", label: "Perfil Empreendedor", weight: 25, isVeto: true },
    { key: "donoBriga", label: "Dono da Briga", weight: 25 },
    { key: "canaisNetwork", label: "Canais/Network", weight: 20 },
  ],
  editais: [
    { key: "pi", label: "PI", weight: 20, isVeto: true },
    { key: "cobertura", label: "Cobertura", weight: 15 },
    { key: "matchRecursos", label: "Match Recursos", weight: 15 },
    { key: "atestados", label: "Atestados", weight: 15, isVeto: true },
    { key: "ecossistema", label: "Ecossistema", weight: 10 },
    { key: "fluxoCaixa", label: "Fluxo Caixa", weight: 15 },
    { key: "roiBurocratico", label: "ROI Burocrático", weight: 10, isVeto: true },
  ],
};

export const SCORECARD_META: Record<string, { pergunta: string; justificativa: string }> = {
  // ── BLOCO 1: Todos os tipos ───────────────────────────────────────────
  diferencial: {
    pergunta: "Tem tecnologia própria, dados ou posição de mercado?",
    justificativa: "Vital para defesa contra concorrência (Moat).",
  },
  alinhamento: {
    pergunta: "Está nas teses da Beyond/Extreme ou a solução gera valor para nossos parceiros atuais?",
    justificativa: "Garante foco estratégico do grupo.",
  },
  problemaReal: {
    pergunta: "Resolve dor latente e comprovada?",
    justificativa: "Evita a 'solução em busca de um problema'.",
  },
  tamSamSom: {
    pergunta: "Range financeiro do mercado.",
    justificativa: "O tamanho do prêmio deve valer o esforço.",
  },
  escalaReceita: {
    pergunta: "Crescimento de receita sem aumento proporcional de custos?",
    justificativa: "Define se é um negócio de tecnologia ou de serviço.",
  },
  escalaB2G: {
    pergunta: "Tem potencial de escala no setor público (B2G)?",
    justificativa: "Avalia o tamanho do mercado governamental endereçável.",
  },
  infraAprov: {
    pergunta: "Usa governança/IA do grupo?",
    justificativa: "Avalia o ganho de eficiência interna.",
  },
  velocidadeMVP: {
    pergunta: "Teste funcional em 1 a 4 semanas?",
    justificativa: "AURORA precisa de ciclos rápidos de aprendizado.",
  },
  vibeCoding: {
    pergunta: "Exige pesquisa demorada ou pode ser construído com vibe coding?",
    justificativa: "Prioriza o Time-to-Market.",
  },
  riscoRegulatorio: {
    pergunta: "Há barreiras regulatórias e/ou jurídicas que inviabilizam o modelo?",
    justificativa: "Filtro Crítico. Nota baixa indica que a iniciativa deve ser pausada.",
  },
  conhecimentoInterno: {
    pergunta: "Já sabemos fazer algo similar internamente?",
    justificativa: "Reduz o risco de execução técnica.",
  },
  processoComercial: {
    pergunta: "Nosso time sabe vender isso?",
    justificativa: "Facilita o Go-to-Market imediato.",
  },
  // ── BLOCO 2: Mercado ─────────────────────────────────────────────────
  perfilFounder: {
    pergunta: "O owner possui perfil empreendedor, resiliência e foco em resultados?",
    justificativa: "Garante que o fundador tem o 'drive' necessário para continuar no grupo.",
  },
  donoBriga: {
    pergunta: "Existe um responsável claro que dedicará o tempo necessário à incubação?",
    justificativa: "Evita que a aquisição vire um 'órfão' tecnológico dentro da AURORA.",
  },
  sinergiaCAC: {
    pergunta: "Conseguimos reduzir custos ou CAC da empresa usando nossa infra de IA e automação?",
    justificativa: "Avalia se a Beyond agrega valor imediato à margem do negócio adquirido.",
  },
  gapEntrega: {
    pergunta: "A empresa já vende, mas falha na entrega/operação por falta de tecnologia?",
    justificativa: "Identifica oportunidades onde a Beyond resolve o principal gargalo do ativo.",
  },
  canaisVenda: {
    pergunta: "O owner possui acesso direto aos canais ou rede necessária para validar?",
    justificativa: "Avalia se a 'porta de entrada' no mercado já está aberta.",
  },
  // ── BLOCO 2: Interno ─────────────────────────────────────────────────
  disponibilidadeReal: {
    pergunta: "O colaborador tem disponibilidade real para se dedicar ao projeto?",
    justificativa: "Critério de Veto. Sem disponibilidade, a iniciativa não evolui.",
  },
  perfilEmpreendedor: {
    pergunta: "O colaborador tem perfil empreendedor e tolerância à ambiguidade?",
    justificativa: "Critério de Veto. Intraempreendedorismo exige mindset diferente do operacional.",
  },
  canaisNetwork: {
    pergunta: "O colaborador tem network ou canais para validar a ideia internamente?",
    justificativa: "Facilita a tração inicial dentro do grupo.",
  },
  // ── BLOCO 2: Editais ─────────────────────────────────────────────────
  pi: {
    pergunta: "Existe risco de conflito de Propriedade Intelectual?",
    justificativa: "Critério de Veto. Conflitos de PI podem inviabilizar o edital inteiro.",
  },
  cobertura: {
    pergunta: "O edital cobre os custos reais de execução do projeto?",
    justificativa: "Evita projetos que consomem mais recursos do que geram.",
  },
  matchRecursos: {
    pergunta: "Temos os recursos humanos e técnicos necessários para executar?",
    justificativa: "Avalia a capacidade de entrega sem sobrecarregar o time.",
  },
  atestados: {
    pergunta: "Temos os atestados técnicos e certificações exigidos pelo edital?",
    justificativa: "Critério de Veto. Sem os atestados, a proposta é desclassificada.",
  },
  ecossistema: {
    pergunta: "O edital fortalece nossa posição no ecossistema de inovação?",
    justificativa: "Avalia o retorno reputacional além do financeiro.",
  },
  fluxoCaixa: {
    pergunta: "O cronograma de desembolso do edital é compatível com nosso fluxo de caixa?",
    justificativa: "Editais com desembolso tardio podem gerar stress financeiro.",
  },
  roiBurocratico: {
    pergunta: "O retorno justifica o esforço burocrático de prestação de contas?",
    justificativa: "Critério de Veto. Alto custo burocrático pode tornar o edital inviável.",
  },
};

export function calcFinalScore(scores: Record<string, number | boolean>, origin: SubmissionOrigin) {
  const b1Fields = BLOCO1_FIELDS;
  const b2Fields = BLOCO2_FIELDS[origin];

  let b1Sum = 0;
  b1Fields.forEach((f) => {
    const val = scores[f.key];
    if (typeof val === "number") b1Sum += val * (f.weight / 100);
  });

  let b2Sum = 0;
  b2Fields.forEach((f) => {
    const val = scores[f.key];
    if (typeof val === "number") b2Sum += val * (f.weight / 100);
  });

  return b1Sum * 0.6 + b2Sum * 0.4;
}

export function checkVetos(scores: Record<string, number | boolean>, origin: SubmissionOrigin): boolean {
  const allFields = [...BLOCO1_FIELDS, ...BLOCO2_FIELDS[origin]];
  return allFields.some((f) => f.isVeto && scores[`veto_${f.key}`] === true);
}

export function getVerdict(score: number, hasVeto: boolean) {
  if (hasVeto) return { label: "REPROVADO", color: "destructive" as const };
  if (score > 80) return { label: "Aprovar", color: "accent" as const };
  if (score >= 60) return { label: "Amadurecer", color: "warning" as const };
  return { label: "Kill", color: "destructive" as const };
}

export function sumWeights(fields: { weight: number }[]): number {
  return fields.reduce((sum, f) => sum + f.weight, 0);
}
