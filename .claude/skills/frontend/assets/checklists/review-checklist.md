# Checklist de Code Review

Use durante revisão de pull requests front-end.
Itens marcados como **[BLOQUEIO]** devem ser corrigidos antes do merge.
Demais itens são sugestões e pontos de conversa.

---

## Reuso de componentes **[BLOQUEIO]**

- [ ] Nenhum componente novo duplica funcionalidade de `src/components/`. O autor listou existentes via `glob src/components/**/*.tsx` antes de criar
- [ ] Botões usam `<Button>` de `@/components/ui/button` — sem classes `.btn-*` inline nem `<button>` cru com estilo recriado
- [ ] Topbar via `<AppTopbar>` — nenhum `<header>` próprio em rota pública
- [ ] Logo via `<BrandLogo>` — sem `<Image src="/logo-*.png">` direto
- [ ] Tokens CSS de `globals.css` usados. Hardcode permitido apenas: `#0044FF`, `#111`, `#666`, `white`, `var(--brand-gradient)`

---

## Acessibilidade **[BLOQUEIO]**

- [ ] Nenhum elemento interativo sem `role` adequado ou tag nativa
- [ ] Nenhum `<img>` sem `alt`
- [ ] Nenhum `outline: none` sem alternativa de foco visível
- [ ] Nenhum `<input>` sem `<label>` associado
- [ ] Contraste de texto ≥ 4.5:1 para novos elementos

---

## Semântica HTML

- [ ] Tags HTML corretas para o conteúdo (não `<div>` para tudo)
- [ ] Headings seguem hierarquia correta
- [ ] Listas usam `<ul>` ou `<ol>`, não `<div>` com bullets CSS
- [ ] `<button>` para ações, `<a>` para navegação — não invertido

---

## Qualidade de código

- [ ] Nomes de variáveis e funções descrevem intenção
- [ ] Sem magic numbers ou magic strings sem constante nomeada
- [ ] Sem código comentado que deveria ser deletado
- [ ] Sem `console.log` esquecido
- [ ] Sem `TODO` sem data e contexto
- [ ] Funções com responsabilidade única e clara

---

## CSS / Estilo

- [ ] Usa variáveis CSS/tokens do projeto (não valores hardcoded)
- [ ] Sem `!important` sem justificativa no comentário
- [ ] Sem valores de z-index arbitrários (usar escala do projeto)
- [ ] Animações têm `prefers-reduced-motion`
- [ ] Nenhum valor de breakpoint diferente dos definidos no projeto

---

## Performance

- [ ] Novas imagens têm `loading="lazy"` (exceto above-the-fold)
- [ ] Novas imagens têm `width` e `height` definidos
- [ ] Nenhuma nova dependência sem justificativa de tamanho/alternativa
- [ ] Sem `useEffect` desnecessário ou com dependências incorretas

---

## Testes

- [ ] Novo comportamento tem teste correspondente
- [ ] Testes testam comportamento, não implementação
- [ ] Casos de erro e edge cases cobertos
- [ ] Nenhum `it.only` ou `test.only` esquecido

---

## Pontos de conversa (não bloqueiam)

Estes itens merecem discussão, mas não necessariamente bloqueiam o merge:

- Componente com > 300 linhas — oportunidade de extração?
- Lógica duplicada em 2+ lugares — oportunidade de abstração?
- Props demais em um componente (> 6-7) — oportunidade de composição?
- Estado que poderia ser URL state — afeta compartilhamento/navegação?
- Nested ternaries — mais legível como `if/else` ou early return?

---

## Template de comentário de review

```
// Para bloqueios:
[BLOQUEIO] Este input não tem label associado.
Sugestão: <label for="email-input">Email</label> ou aria-label no input.

// Para sugestões:
[SUGESTÃO] Esta lógica aparece também em UserForm.jsx.
Poderia ser extraída para um hook useFormValidation?

// Para perguntas:
[PERGUNTA] Há alguma razão para usar px aqui em vez do token --space-md?
Apenas checando se é intencional.

// Para elogios (importante!):
[ELOGIO] Boa solução para o focus trap — clean e acessível.
```
