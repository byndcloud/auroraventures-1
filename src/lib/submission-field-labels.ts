/**
 * Maps database keys to the exact form labels shown to users during submission.
 * Organized by sections matching the form steps.
 */

export interface FieldSection {
  title: string;
  fields: { key: string; label: string }[];
}

// ── MERCADO ──────────────────────────────────────────────────

const MERCADO_FOUNDERS: FieldSection = {
  title: "Founders",
  fields: [
    { key: "name", label: "Nome completo" },
    { key: "phone", label: "Telefone" },
    { key: "email", label: "Email" },
    { key: "gender", label: "Gênero" },
    { key: "birthdate", label: "Data de nascimento" },
    { key: "city", label: "Cidade que vive" },
    { key: "socialMedia", label: "Redes sociais" },
    { key: "education", label: "Educação" },
    { key: "workHistory", label: "Histórico de trabalho" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "achievements", label: "Quais conquistas o fundador se orgulha de ter alcançado?" },
    { key: "projects", label: "Conte-nos sobre projetos que você já desenvolveu. Inclua URLs, se possível." },
    { key: "title", label: "Qual é o seu título? (CEO, CTO, Vendas, etc.)" },
    { key: "founderEquity", label: "Quanto de equity você tem? (%)" },
    { key: "hours", label: "Qual a disponibilidade real (horas/semana) para se dedicar ao projeto?" },
    { key: "technical", label: "Você é um founder técnico? (desenvolvedor)" },
    { key: "inCollege", label: "Você está atualmente na faculdade?" },
    { key: "founderVideo", label: "Envio de apresentação em vídeo de até 1 minuto do founder (URL)" },
    { key: "techPerson", label: "Quem escreve o código ou faz o trabalho técnico?" },
    { key: "howMet", label: "Como o time de fundadores se conheceu?" },
  ],
};

const MERCADO_SOLUCAO: FieldSection = {
  title: "Solução",
  fields: [
    { key: "solutionName", label: "Nome da solução/empresa" },
    { key: "shortDescription", label: "Descreva o que a solução faz em 50 caracteres ou menos" },
    { key: "whyIdea", label: "Por que você escolheu esta ideia? Possui experiência prática nesta área?" },
    { key: "vertical", label: "Vertical" },
    { key: "headquarters", label: "Onde a empresa está sediada?" },
    { key: "pitchDeck", label: "Envio Pitch Deck (PDF/PPT) (Link compartilhável)" },
    { key: "videoDemo", label: "Envio Vídeo de Demo da solução (até 5 min)" },
  ],
};

const MERCADO_PROGRESSO: FieldSection = {
  title: "Progresso",
  fields: [
    { key: "timeWorking", label: "Há quanto está se trabalhando no projeto? Quanto desse tempo foi em regime de tempo integral?" },
    { key: "cashBurn", label: "Qual o cash balance (caixa atual) e o burn rate mensal (queima de caixa)?" },
    { key: "revenueProjection", label: "A empresa fez alguma projeção de faturamento? Se sim, compartilhe os principais números e premissas." },
    { key: "sellsButFails", label: "A empresa já vende, mas falha na entrega/operação por carência de tecnologia?" },
    { key: "techStack", label: "Que conjunto de tecnologias você está usando, ou planeja usar? Inclua os modelos de IA e as ferramentas de programação de IA que você utiliza." },
    { key: "reduceCosts", label: "É possível reduzir custos de desenvolvimento ou CAC utilizando a expertise do Extreme Group?" },
    { key: "mvp4weeks", label: "É possível testar uma versão funcional (MVP) em no máximo 4 semanas?" },
  ],
};

const MERCADO_MERCADO: FieldSection = {
  title: "Problema & Mercado",
  fields: [
    { key: "whyThisIdea", label: "Por que você escolheu desenvolver essa ideia? Você tem experiência na área? Como você sabe que as pessoas precisam do que você está criando?" },
    { key: "painPoint", label: "Qual dor latente esta solução resolve? Existem evidências ou dados que comprovam essa dor?" },
    { key: "valueProposition", label: "Para [Públicos/Clientes] que têm [Problema], nós oferecemos [Solução/Produto]." },
    { key: "whyUs", label: "Por que somos os melhores para resolver isso? Temos tecnologia própria, dados exclusivos ou posição de mercado única?" },
    { key: "competitors", label: "Quem são os principais concorrentes e o que vocês entendem sobre o negócio que eles ainda não entenderam?" },
    { key: "marketSize", label: "Qual o TAM, SAM e SOM aproximado?" },
    { key: "scalability", label: "O modelo permite crescimento de receita sem aumento proporcional de custos?" },
    { key: "salesChannels", label: "Possui acesso direto a canais de venda?" },
    { key: "regulatory", label: "Existe alguma barreira legal imediata?" },
  ],
};

const MERCADO_EQUITY: FieldSection = {
  title: "Equity & Estrutura",
  fields: [
    { key: "equityBreakdown", label: "Qual o percentual de equity detido pelos fundadores e outros acionistas?" },
    { key: "hasCNPJ", label: "Algum dos founders já possui CNPJ ou outra empresa constituída?" },
    { key: "externalInvestment", label: "Já receberam algum investimento externo ou estão captando no momento?" },
    { key: "thirdPartyDep", label: "Existe dependência de terceiros não-sócios para a tecnologia core?" },
  ],
};

const MERCADO_EXPECTATIVAS: FieldSection = {
  title: "Expectativas",
  fields: [
    { key: "whyApply", label: "O que o convenceu a aplicar para o modelo de Venture Builder da Beyond?" },
    { key: "expectations", label: "Em quais áreas você espera receber mais ajuda? (Ex: Vendas, Desenvolvimento de Software, Jurídico, Contatos B2G)" },
  ],
};

// ── INTERNA ──────────────────────────────────────────────────

const INTERNA_FOUNDERS: FieldSection = {
  title: "Founders",
  fields: [
    ...MERCADO_FOUNDERS.fields.filter(f =>
      ["name", "phone", "email", "gender", "birthdate", "city", "socialMedia",
       "education", "workHistory", "linkedin", "achievements", "projects"].includes(f.key)
    ),
  ],
};

const INTERNA_SOLUCAO: FieldSection = {
  title: "Solução",
  fields: [
    { key: "solutionName", label: "Nome da solução" },
    { key: "shortDescription", label: "Descreva o que a solução faz em 50 caracteres ou menos" },
    { key: "whyIdea", label: "Por que você escolheu esta ideia? Possui experiência prática nesta área?" },
    { key: "vertical", label: "Vertical" },
    { key: "pitchDeck", label: "Envio Pitch Deck (PDF/PPT) (Link compartilhável)" },
    { key: "videoDemo", label: "Envio Vídeo de Demo da solução (até 5 min)" },
  ],
};

const INTERNA_PROGRESSO: FieldSection = {
  title: "Progresso",
  fields: [
    { key: "timeWorking", label: "Há quanto tempo cada um está trabalhando nisso? Por favor, explique." },
    { key: "cashBurn", label: "Qual o cash balance (caixa atual) e o burn rate mensal (queima de caixa)?" },
    { key: "revenueProjection", label: "A empresa fez alguma projeção de faturamento? Se sim, compartilhe os principais números e premissas." },
    { key: "techStack", label: "Que conjunto de tecnologias você está usando, ou planeja usar? Inclua os modelos de IA e as ferramentas de programação de IA que você utiliza." },
    { key: "reduceCosts", label: "É possível reduzir custos de desenvolvimento ou CAC utilizando a infra de IA e automação da Beyond?" },
    { key: "mvp4weeks", label: "É possível testar uma versão funcional (MVP) em no máximo 4 semanas?" },
  ],
};

const INTERNA_MERCADO: FieldSection = {
  title: "Problema & Mercado",
  fields: [
    { key: "whyThisIdea", label: "Por que você escolheu desenvolver essa ideia? Como você sabe que as pessoas precisam do que você está criando?" },
    { key: "painPoint", label: "Qual dor latente esta solução resolve? Existem evidências ou dados que comprovam essa dor?" },
    { key: "valueProposition", label: "Para [Públicos/Clientes] que têm [Problema], nós oferecemos [Solução/Produto]." },
    { key: "whyUs", label: "Por que somos os melhores para resolver isso? Temos tecnologia própria, dados exclusivos ou posição de mercado única?" },
    { key: "competitors", label: "Quem são os principais concorrentes e o que vocês entendem sobre o negócio que eles ainda não entenderam?" },
    { key: "marketSize", label: "Qual o TAM, SAM e SOM aproximado?" },
    { key: "scalability", label: "O modelo permite crescimento de receita sem aumento proporcional de custos?" },
    { key: "salesChannels", label: "Possui acesso direto a canais de venda?" },
    { key: "regulatory", label: "Existe alguma barreira legal imediata?" },
  ],
};

const INTERNA_EXPECTATIVAS: FieldSection = {
  title: "Expectativas",
  fields: [
    { key: "whyApply", label: "O que o convenceu a aplicar para o modelo de Venture Builder da Beyond?" },
    { key: "expectations", label: "Em quais áreas você espera receber mais ajuda? (Ex: Vendas, Desenvolvimento de Software, Jurídico, Contatos B2G)" },
  ],
};

// ── EDITAIS ──────────────────────────────────────────────────

const EDITAIS_OWNER: FieldSection = {
  title: "Owner",
  fields: [
    { key: "ownerName", label: "Nome completo" },
    { key: "ownerPhone", label: "Telefone" },
    { key: "ownerEmail", label: "Email" },
  ],
};

const EDITAIS_INFO: FieldSection = {
  title: "Informações Básicas",
  fields: [
    { key: "editalName", label: "Nome do Edital e Órgão Fomentador" },
    { key: "editalType", label: "Tipo" },
    { key: "editalLink", label: "Link oficial do Edital" },
    { key: "submissionLink", label: "Link de Submissão" },
    { key: "deadline", label: "Data Limite para Submissão" },
    { key: "maxValue", label: "Valor Máximo Financiado (Ticket)" },
    { key: "counterpart", label: "Qual o percentual ou valor de contrapartida financeira ou econômica (horas de time) que a Beyond precisará aportar?" },
  ],
};

const EDITAIS_ELEGIBILIDADE: FieldSection = {
  title: "Critérios de Elegibilidade",
  fields: [
    { key: "intellectualProperty", label: "O edital garante que a Propriedade Intelectual (PI) da solução desenvolvida permanecerá 100% com a Beyond/Extreme Group, ou há exigência de copropriedade?" },
    { key: "certifications", label: "Nós já possuímos todos os atestados de capacidade técnica e certidões exigidas para participar deste edital?" },
    { key: "costBenefit", label: "O valor financiado pelo edital é maior do que o custo e o esforço burocrático de escrever o projeto e prestar contas? A solução gerada terá valor de mercado futuro?" },
    { key: "ictRequirement", label: "O edital exige a participação obrigatória de ICTs, universidades ou outras startups no consórcio?" },
  ],
};

const EDITAIS_PROBLEMA: FieldSection = {
  title: "Problema e Solução",
  fields: [
    { key: "editalPain", label: "Qual a dor latente que o edital visa resolver?" },
    { key: "valueSentence", label: "Para [Públicos/Clientes do Edital] que sofrem com [Problema], nós propomos construir [Solução], utilizando [Nossa Tecnologia/Diferencial]." },
    { key: "thesisFit", label: "A solução exigida pelo edital se encaixa nas teses da Beyond (LegalTechs, EdTechs, HealthTechs, GovTechs) ou gera valor para nossos parceiros atuais?" },
  ],
};

const EDITAIS_VIABILIDADE: FieldSection = {
  title: "Viabilidade e Escala",
  fields: [
    { key: "fundingCoverage", label: "O valor do fomento cobre integralmente o desenvolvimento da solução? O dinheiro é liberado em tempo compatível com a nossa necessidade?" },
    { key: "scalability", label: "Após entregarmos o projeto, esta solução pode ser vendida de forma escalável (como SaaS) para outros clientes?" },
    { key: "regulatoryBarrier", label: "Existe alguma barreira regulatória ou norma técnica complexa atrelada ao escopo deste edital que possa inviabilizar o negócio?" },
  ],
};

const EDITAIS_EXECUCAO: FieldSection = {
  title: "Execução",
  fields: [
    { key: "infraReuse", label: "Quais tecnologias que já possuímos internamente podem ser reutilizadas para acelerar a entrega deste projeto?" },
    { key: "vibeCoding", label: "É possível utilizarmos ferramentas de Vibe Coding e IA para rodar um teste ou entregar um MVP funcional dentro de 1 a 4 semanas?" },
    { key: "responsible", label: "Quem será a pessoa ou área responsável por capitanear as reuniões com o time técnico, desenhar os requisitos V0 e garantir a submissão?" },
  ],
};

// ── Exported maps ────────────────────────────────────────────

export const SECTIONS_BY_ORIGIN: Record<string, FieldSection[]> = {
  mercado: [MERCADO_FOUNDERS, MERCADO_SOLUCAO, MERCADO_PROGRESSO, MERCADO_MERCADO, MERCADO_EQUITY, MERCADO_EXPECTATIVAS],
  interna: [INTERNA_FOUNDERS, INTERNA_SOLUCAO, INTERNA_PROGRESSO, INTERNA_MERCADO, INTERNA_EXPECTATIVAS],
  editais: [EDITAIS_OWNER, EDITAIS_INFO, EDITAIS_ELEGIBILIDADE, EDITAIS_PROBLEMA, EDITAIS_VIABILIDADE, EDITAIS_EXECUCAO],
};

/** Flat key→label map for all origins (used as fallback) */
export function buildLabelMap(origin: string): Record<string, string> {
  const sections = SECTIONS_BY_ORIGIN[origin] || Object.values(SECTIONS_BY_ORIGIN).flat();
  const map: Record<string, string> = {};
  for (const sec of sections) {
    for (const f of sec.fields) {
      map[f.key] = f.label;
    }
  }
  return map;
}
