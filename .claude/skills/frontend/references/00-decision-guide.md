# 00 — Guia de Decisão

Use este arquivo quando a tarefa for ambígua ou multidisciplinar.
Identifique o domínio principal e siga para o arquivo correto.

## Diagnóstico rápido

### O pedido envolve criação de UI?
- **Componente isolado** (botão, card, input, dropdown) → `01-component-patterns.md`
- **Página ou tela completa** → `01-component-patterns.md` + `02-responsive-layout.md`
- **Sistema de design ou tema** → `06-design-tokens.md`

### O pedido é sobre qualidade ou correção?
- **Acessibilidade** (a11y, screen reader, contraste, WCAG) → `03-accessibility.md`
- **Lentidão, bundle grande, Core Web Vitals** → `04-performance.md`
- **Code review, testes, convenções** → `08-code-quality.md`

### O pedido envolve comportamento ou interação?
- **Animação, hover, transição, loading** → `05-animation-motion.md`
- **Estado local, global, servidor, URL** → `07-state-patterns.md`
- **Layout fluido, responsividade, breakpoints** → `02-responsive-layout.md`

## Combinações frequentes

| Cenário real                                    | Referências                              |
|-------------------------------------------------|------------------------------------------|
| "Crie um modal acessível com animação de entrada" | 01 + 03 + 05                           |
| "Meu site está lento no mobile"                 | 04 + 02                                  |
| "Implemente dark mode no sistema de design"     | 06 + 02                                  |
| "Refatore esse componente para ser testável"    | 01 + 08                                  |
| "Crie um formulário com validação de estado"    | 01 + 07 + 03                             |
| "Audite e corrija a acessibilidade da nav"      | 03 + 01                                  |

## Sinais de alerta (leia 03-accessibility.md imediatamente)

Se o código existente contiver qualquer um destes, trate como prioridade:
- `div` com `onClick` sem `role` e sem `tabIndex`
- `<img>` sem `alt`
- `<input>` sem `<label>` associado
- `outline: none` ou `outline: 0` sem alternativa de foco
- Contraste de texto < 4.5:1
- Animações sem `prefers-reduced-motion`

## Quando nenhum arquivo se encaixa exatamente

Pergunte: "Qual é o resultado entregável?"
- Código de UI → comece por `01-component-patterns.md`
- Diagnóstico / relatório → comece por `04-performance.md` ou `03-accessibility.md`
- Arquitetura / decisão técnica → comece por `07-state-patterns.md` ou `08-code-quality.md`
