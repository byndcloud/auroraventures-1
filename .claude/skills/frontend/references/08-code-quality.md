# 08 — Qualidade de Código

## Índice
1. [Convenções de nomenclatura](#nomenclatura)
2. [Estrutura de pastas](#estrutura)
3. [Tipos de teste](#testes)
4. [O que testar (e o que não testar)](#o-que-testar)
5. [Critérios de code review](#review)
6. [Dívida técnica — quando aceitar e quando corrigir](#dívida)

---

## Convenções de Nomenclatura {#nomenclatura}

**Componentes:** PascalCase — `UserCard`, `ProductList`, `NavigationMenu`

**Funções e variáveis:** camelCase — `getUserById`, `isLoading`, `currentPage`

**Constantes:** SCREAMING_SNAKE_CASE — `MAX_RETRIES`, `API_BASE_URL`

**Arquivos de componente:** PascalCase — `UserCard.jsx`, `UserCard.tsx`

**Arquivos utilitários:** camelCase — `formatDate.ts`, `useDebounce.ts`

**CSS classes:** kebab-case com BEM opcional —
`card`, `card__header`, `card--featured`

**CSS custom properties:** kebab-case — `--color-primary`, `--space-md`

**Padrões de nomenclatura por tipo:**
```
Booleanos:     is*, has*, can*, should*  →  isOpen, hasError, canSubmit
Event handlers: handle*, on*            →  handleSubmit, onClose
Hooks:         use*                     →  useDebounce, useLocalStorage
HOC:           with*                    →  withAuth, withErrorBoundary
Context:       *Context                 →  ThemeContext, AuthContext
```

---

## Estrutura de Pastas {#estrutura}

Não existe estrutura universal — adapte ao tamanho e complexidade do projeto.

**Estrutura por tipo** (projetos pequenos/médios):
```
src/
├── components/     # Componentes reutilizáveis
├── pages/          # Componentes de rota / views
├── hooks/          # Custom hooks / composables
├── utils/          # Funções puras utilitárias
├── services/       # Comunicação com APIs
├── stores/         # Gerenciamento de estado global
├── styles/         # CSS global, tokens, reset
└── types/          # Tipos TypeScript compartilhados
```

**Estrutura por feature** (projetos grandes):
```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── index.ts    ← barrel export
│   ├── products/
│   └── checkout/
├── shared/
│   ├── components/     # Componentes verdadeiramente compartilhados
│   ├── hooks/
│   └── utils/
└── app/                # Configuração, routing, providers
```

**Colocation:** mantenha o que muda junto, próximo.
`UserCard.tsx`, `UserCard.test.tsx`, `UserCard.module.css` — mesma pasta.

**Barrel exports (index.ts):** use com moderação.
Facilita imports limpos mas pode criar dependências circulares.

---

## Tipos de Teste {#testes}

### Teste unitário de componente
Testa um componente em isolamento, com dependências mockadas.
**O que verificar:**
- Renderiza o estado inicial corretamente
- Responde a props/inputs como esperado
- Chama callbacks com os argumentos corretos
- Renderiza estados condicionais (loading, error, empty)

```
// Estrutura de um teste de componente:
describe('UserCard', () => {
  it('exibe o nome do usuário', () => { ... })
  it('exibe skeleton durante loading', () => { ... })
  it('chama onDelete ao clicar em Remover', () => { ... })
  it('não exibe botão de admin para usuário comum', () => { ... })
})
```

### Teste de integração
Testa múltiplos componentes interagindo.
**O que verificar:**
- Fluxos de usuário (preenche formulário → submete → vê confirmação)
- Comunicação entre componentes (pai/filho, context)
- Navegação entre rotas

### Teste de acessibilidade automatizado
```
// Com jest-axe ou similar:
it('não tem violações de acessibilidade', async () => {
  const { container } = render(<Component />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### Visual regression
Captura screenshot e compara com baseline.
Use para componentes com muitas variantes visuais complexas.
Ferramentas: Chromatic, Percy, Playwright visual testing.

### Testes E2E
Simula interação real do usuário no browser.
Reserve para fluxos críticos de negócio: autenticação, checkout, submissão de formulário.
Ferramentas: Playwright (recomendado), Cypress.

---

## O que Testar (e o Que Não Testar) {#o-que-testar}

**Teste:**
- Lógica de negócio em funções puras (formatação, cálculo, validação)
- Comportamento de componente em resposta a interação
- Edge cases: lista vazia, erro de rede, dados inválidos
- Fluxos críticos de usuário

**Não teste (ou teste com cautela):**
- Detalhes de implementação (nomes internos de variáveis, ordem de chamadas)
- Estilos visuais (use visual regression para isso)
- Comportamento de bibliotecas de terceiros
- Snapshots gigantes de markup (quebram com qualquer mudança de DOM)

**Critério prático:**
> "Se eu refatorar este componente sem mudar seu comportamento externo,
> os testes devem continuar passando."

Se a resposta for "não", você está testando implementação, não comportamento.

---

## Critérios de Code Review {#review}

### Semântica e acessibilidade
- [ ] Elementos HTML semânticos corretos (button, not div)
- [ ] Todos os inputs têm labels
- [ ] Imagens têm alt descritivo (ou alt="" para decorativas)
- [ ] Foco visível em elementos interativos

### Qualidade de código
- [ ] Nomes descrevem intenção, não implementação
- [ ] Funções têm responsabilidade única (< 30 linhas como guia, não regra)
- [ ] Sem comentários que explicam "o que" (o código deve ser auto-explicativo)
- [ ] Comentários existentes explicam "por quê" — decisões não-óbvias

### Performance
- [ ] Sem loops desnecessários dentro de renders
- [ ] Lazy loading aplicado onde relevante
- [ ] Sem dependências adicionadas sem justificativa

### Manutenibilidade
- [ ] Sem magic numbers/strings (use constantes nomeadas)
- [ ] Sem código duplicado sem razão
- [ ] Testes cobrem o novo comportamento
- [ ] Mudança tem escopo claro (não mistura features)

### Sinais de alerta que pedem conversa (não bloqueio automático):
- Componente com > 300 linhas
- Função com > 5 parâmetros
- Nested ternaries (`a ? b ? c : d : e`)
- `useEffect` com muitas dependências sem comentário explicativo

---

## Dívida Técnica — Quando Aceitar e Quando Corrigir {#dívida}

**Aceite conscientemente (registre com `// TODO:` + data + contexto):**
- Simplicidade proposital por deadline — refatore na próxima sprint
- Solução temporária enquanto a API está em desenvolvimento
- Performance abaixo do ideal em feature de baixo tráfego

**Corrija imediatamente:**
- Dívida que bloqueia outro trabalho
- Componente que está sendo modificado frequentemente (lei do escoteiro)
- Bug de acessibilidade ou segurança
- Código que ninguém no time entende mais

**Regra da lei do escoteiro:**
> Deixe o código um pouco melhor do que encontrou.
> Não precisa refatorar tudo — só a parte que você tocou.
