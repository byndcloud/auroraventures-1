---
name: frontend
description: >
  Crie, refatore, audite e aprimore interfaces front-end em qualquer stack.
  Use esta skill para: construção de componentes e páginas, layouts responsivos,
  auditorias de acessibilidade (a11y), otimizações de performance e bundle,
  animações e micro-interações, sistemas de design tokens, padrões de estado,
  e code review de código front-end. Acione sempre que o usuário mencionar
  componente, UI, interface, CSS, HTML, layout, tela, acessibilidade, a11y,
  bundle, responsivo, interação, animação, design system, tokens, tema, dark mode,
  formulário, modal, navegação, ou qualquer entrega visual — mesmo que não cite
  "front-end" explicitamente. Esta skill cobre qualquer framework ou stack:
  React, Vue, Svelte, Angular, Astro, Next.js, Nuxt, SvelteKit, ou Vanilla.
---

# Frontend Skill

Entregas front-end de alta qualidade: funcionais, acessíveis, performáticas
e com identidade visual genuína — sem padrões repetitivos de IA.

## Qual referência ler

Leia **apenas** o(s) arquivo(s) relevante(s) para a tarefa atual.

| Tarefa                                        | Leia primeiro               | Combine com                 |
|-----------------------------------------------|-----------------------------|-----------------------------|
| Tarefa nova, pedido ambíguo                   | 00-decision-guide.md        | —                           |
| Criar ou refatorar componente                 | 01-component-patterns.md    | 06-design-tokens.md         |
| Layout, grid, breakpoints, responsividade     | 02-responsive-layout.md     | —                           |
| Auditoria, correção ou revisão de a11y        | 03-accessibility.md         | 08-code-quality.md          |
| Performance, Core Web Vitals, bundle          | 04-performance.md           | —                           |
| Animação, transição, micro-interação          | 05-animation-motion.md      | —                           |
| Design tokens, tema, dark mode, CSS vars      | 06-design-tokens.md         | 02-responsive-layout.md     |
| Gerenciamento de estado, fluxo de dados       | 07-state-patterns.md        | 01-component-patterns.md    |
| Code review, testes, convenções               | 08-code-quality.md          | —                           |
| Next.js App Router, Nuxt, SvelteKit, SSR      | 09-ssr-frameworks.md        | 01-component-patterns.md    |

Se a tarefa envolver **design visual** (escolha tipográfica, paleta, composição),
leia também `references/01-component-patterns.md` — seção "Identidade Visual".

## Contexto de projeto

Antes de qualquer entrega visual, verifique se existe um `design.md` (ou equivalente:
`DESIGN.md`, `docs/design.md`, `docs/design/design.md`, `docs/visual.md`) no contexto
da conversa ou nos arquivos do projeto.

**Se existir:**
- Leia antes de escolher tipografia, paleta, tokens ou composição
- As decisões registradas no `design.md` têm prioridade sobre os defaults desta skill
- Se houver conflito entre o `design.md` e as referências da skill, o `design.md` vence
- Se existir também um `design_system.html` na mesma pasta (ex: `docs/design/design_system.html`),
  use-o como fonte de especificações detalhadas de componentes, tokens CSS e anti-padrões —
  o HTML complementa o `design.md` com exemplos completos e especificações de cada componente

**Se não existir e a tarefa for visual:**
- Documente as escolhas feitas ao final da entrega (fontes, paleta, tokens, rationale)
- Ofereça gerar um `design.md` com essas decisões para uso em sessões futuras

**Design system do projeto**
Verifique também se o projeto usa um design system estabelecido (Radix, shadcn/ui,
Material, Ant Design, Chakra, Mantine, ou customizado). Se sim:
- Use os componentes e tokens do design system como base — não reinvente o que já existe
- Consulte `references/06-design-tokens.md` para mapear os tokens do sistema externo
  para a estrutura semântica local
- Só crie componentes custom quando o design system não cobre o caso de uso

### Inventário de componentes — passo bloqueante

**Antes de escrever JSX**, execute o checklist abaixo. Pular este passo é considerado falha de skill:

1. Liste componentes existentes:
   ```bash
   glob src/components/**/*.tsx
   ```
2. Leia a seção "Componentes existentes — reusar antes de criar" no `design.md` do projeto (se existir).
3. Para cada componente que você planeja criar, responda em uma linha:
   - **Já existe algo que cobre 80% do caso?** Se sim → estenda por props ou composição.
   - **Se não existe**, por que o caso é genuinamente novo? Registre no resumo final.
4. Use os primitives canônicos do projeto (Aurora usa **shadcn/ui + Radix**):
   - Botões via `<Button>` de `@/components/ui/button` (shadcn CVA + Radix Slot) — nunca classes `.btn-*` inline nem `<button>` cru com Tailwind
   - Modais via `<Dialog>` de `@/components/ui/dialog`, confirmações via `<AlertDialog>` de `@/components/ui/alert-dialog`, drawers via `<Drawer>` / `<Sheet>` (`vaul` + `@/components/ui/sheet`)
   - Toasts via `<Toaster>` do `sonner` (já montado) — use `toast()` de `sonner`, não invente sistema paralelo
   - Form fields via `react-hook-form` + `@hookform/resolvers` + `<Label>` + `<Input>` / `<Textarea>` / `<Select>` de `@/components/ui/*`; validação com `zod`
   - Logo da marca via `<AuroraLogo>` de `@/components/AuroraLogo` — nunca hardcode SVG inline
   - Header/topbar público via `<Header>` de `@/components/landing/Header`; em rotas autenticadas siga o layout de `src/pages/Admin.tsx` — nunca renderize `<header>` próprio
   - Link/navegação via `react-router-dom` (`<Link>`, `<NavLink>`) — nunca `<a href>` para rotas internas
   - Ícones via `lucide-react` (padrão do shadcn) ou `@hugeicons/react` quando já existir no arquivo — não misture bibliotecas novas

**Duplicação silenciosa de componente existente é o anti-padrão mais comum desta skill** — especialmente em agentes externos (Lovable, Replit, Cursor). Se houver dúvida entre estender vs criar, **estenda**.

### Override de defaults

A seção "Identidade Visual" em `references/01-component-patterns.md` ensina anti-padrões genéricos de IA (evitar Inter/Roboto, gradiente roxo, etc.). Se o projeto tem `design.md`, **as decisões do `design.md` vencem** — incluindo escolha de fonte, paleta e padrões de seção. As referências da skill só valem quando não há design system definido.



Antes de qualquer entrega de código, identifique:
- **Framework** de componentes (React / Vue / Svelte / Angular / Vanilla)
- **Sistema de estilos** (CSS Modules / Tailwind / CSS-in-JS / plain CSS / SCSS)
- **Build tool** (Vite / Webpack / Parcel / nenhum)
- **TypeScript?** (sim / não)

Infira do contexto (imports visíveis, arquivos mencionados, extensões).
Se não for possível inferir, faça **uma única pergunta** antes de entregar código.
Nunca entregue código com sintaxe ou imports de framework sem confirmação.

## Princípios de entrega

**Código**
- Sempre entregue código completo e funcional — sem `// ...resto aqui`
- Comente decisões não-óbvias de acessibilidade, performance e semântica
- Se a tarefa exigir mudanças em múltiplos arquivos, liste-os todos explicitamente
- CSS-first: use JavaScript somente quando CSS não resolve
- Prefira soluções nativas da plataforma antes de adicionar dependências

**Identidade visual**
- Leia `references/01-component-patterns.md` (seção "Identidade Visual") para
  diretrizes completas sobre tipografia, cor, composição e motion
- Nunca use Inter/Roboto/Arial como escolha primária — são placeholder, não escolha
- Nunca use gradiente roxo em fundo branco como esquema padrão
- Nunca repita o mesmo layout card-grid para contextos diferentes sem questionar
- Toda entrega visual deve ter um ponto de vista claro: o que a torna memorável?

**Acessibilidade (não-negociável)**
- Todo componente interativo: foco visível, role correto, label descritivo
- `prefers-reduced-motion` aplicado em toda animação
- Contraste mínimo 4.5:1 para texto, 3:1 para elementos UI

## Scripts automáticos

Execute via `bash_tool` quando relevante — não requer leitura prévia do arquivo:

```bash
# Auditoria de acessibilidade (URL local obrigatória)
python /path/to/skill/scripts/audit-a11y.py <url>

# Análise de bundle (caminho do output de build)
python /path/to/skill/scripts/analyze-bundle.py <path-to-stats.json>
```

Inclua o output no contexto antes de propor correções.

## Assets disponíveis

Leia sob demanda — não carregue preventivamente:
- `assets/snippets/component-template.md` — boilerplate de componente genérico
- `assets/snippets/css-reset.md` — CSS reset moderno comentado
- `assets/snippets/common-patterns.md` — modal, drawer, toast, skeleton, accordion, **carousel**
- `assets/checklists/launch-checklist.md` — verificações pré-deploy
- `assets/checklists/review-checklist.md` — pontos de code review
