# 0002 — PDF de iniciativa via `window.print()` (interim)

- **Status:** Accepted
- **Data:** 2026-07-20
- **Task relacionada:** [2026-07-20-fixes-tech-debt-triage](../task-history/2026-07-20-fixes-tech-debt-triage.md)

## Contexto

`src/pages/IniciativaDetalhe.tsx` tinha uma função `handleExportPDF` que:
1. Importava `html2canvas-pro` + `jspdf` dinamicamente.
2. Rasterizava `#iniciativa-root` em canvas 2x com `useCORS: true`.
3. Fatiava a imagem em páginas A4, aplicava header/footer via `jspdf`.

Problemas apurados:
- **Bundle**: `html2canvas-pro` + `jspdf` = ~400 KB gzip só para exportar PDF, com import lazy que ainda pesa no primeiro clique.
- **Fidelidade**: dark theme com `color-mix()` / gradientes falhava no rasterizador; texto perdia seleção; hyperlinks morriam.
- **Manutenção**: código de fatiar página em A4 + clipping + header manual era frágil e sem teste.
- Alvo real (BLUEPRINT §5.6) é PDF server-side via Puppeteer/Browserless. Implementar isso agora exigiria uma Edge Function nova + gerenciamento de headless browser — fora do escopo do triage de dívida técnica.

## Decisão

Substituímos a rasterização por `window.print()` + regras CSS `@media print` em `src/index.css`.

- Botão "Exportar PDF" no header dispara `window.print()`.
- Usuário escolhe "Salvar como PDF" no diálogo nativo do navegador.
- Fundo branco + texto escuro na impressão (economia de toner + legibilidade).
- Chrome sticky (nav, tabs, print:hidden) escondido no papel.
- Cards com borda cinza suave em vez do `bg-card` escuro.

Removemos as deps `html2canvas-pro` e `jspdf`.

## Consequências

**Positivas:**
- Bundle 400+ KB menor.
- Fidelidade nativa: fontes vetoriais, seleção de texto, hyperlinks preservados.
- Zero código customizado para paginação — browser cuida.
- Preview interativo do diálogo de impressão (usuário vê antes de salvar).

**Negativas / trade-offs aceitos:**
- Depende do usuário escolher "Salvar como PDF" (Chrome/Edge/Firefox modernos suportam; Safari precisa habilitar).
- CSS `@media print` precisa ser mantido junto com o tema — mudanças no dark theme podem quebrar a impressão silenciosamente (mitigação: smoke test manual no review do PR + follow-up para test Playwright de impressão).
- Sem header/footer customizado ("AURORA." + "Página X de Y") — browser controla.
- Não roda em contexto server-side (não dá para agendar geração de relatório por cron).

**Neutras:**
- UX muda: em vez de download automático, abre diálogo. Adicionamos `title` no botão explicando.

## Alternativas consideradas

- **Manter html2canvas-pro + jspdf com fix de dark theme** — reprodução artesanal do renderer do browser é dívida sem fim.
- **`react-to-print`** — wrapper de `window.print()` com portal; benefício marginal, adiciona dep.
- **PDF server-side via Puppeteer/Edge Function** — solução alvo mas fora do escopo desta branch. Follow-up registrado em `docs/FOLLOWUPS.md`.
- **`react-pdf` (renderer próprio)** — reescrever toda a página em componentes de PDF é trabalho grande demais para o ganho.

## Notas

- CSS: bloco `@media print` no fim de `src/index.css`.
- Deps removidas: `html2canvas-pro`, `jspdf`.
- Migração futura para server-side PDF: `docs/FOLLOWUPS.md` · "PDF server-side (Puppeteer/Browserless)".
