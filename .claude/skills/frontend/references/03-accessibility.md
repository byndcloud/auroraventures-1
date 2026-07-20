# 03 — Acessibilidade (a11y)

## Índice
1. [Princípios WCAG 2.2](#wcag)
2. [Semântica HTML](#semântica)
3. [Foco e navegação por teclado](#foco)
4. [ARIA — quando e como usar](#aria)
5. [Padrões por componente](#padrões) ← inclui Carousel e Foco Dinâmico
6. [Foco em conteúdo dinâmico](#foco-dinâmico)
7. [Contraste e cor](#contraste)
8. [Motion e animação](#motion)
9. [Checklist rápida](#checklist)

---

## Princípios WCAG 2.2 {#wcag}

**Nível A (mínimo absoluto)** — nunca entregue código que viole estes:
- Alternativas textuais para conteúdo não-textual
- Conteúdo acessível por teclado
- Sem armadilhas de foco (focus trap legítimas são OK; acidentais não)
- Sem conteúdo que pisque mais de 3x/segundo

**Nível AA (padrão de entrega)** — aplique em toda entrega:
- Contraste 4.5:1 para texto normal, 3:1 para texto grande (18px+ / 14px bold+)
- Contraste 3:1 para componentes de UI e elementos gráficos
- Foco visível com contraste mínimo 3:1 contra adjacente
- Labels descritivos para todos os controles
- Mensagens de erro identificadas e descritivas

---

## Semântica HTML {#semântica}

Use o elemento HTML correto antes de usar ARIA.

```html
<!-- RUIM: div com comportamento de botão -->
<div class="btn" onclick="submit()">Enviar</div>

<!-- BOM: elemento nativo -->
<button type="submit">Enviar</button>
```

**Landmarks obrigatórios em páginas completas:**
```html
<header role="banner">...</header>
<nav aria-label="Navegação principal">...</nav>
<main>...</main>
<aside aria-label="Conteúdo relacionado">...</aside>
<footer role="contentinfo">...</footer>
```

**Hierarquia de headings:**
- Um único `<h1>` por página
- Não pule níveis (h1 → h3 sem h2 no meio)
- Use headings para estrutura, não para estilo

**Listas:** use `<ul>/<ol>` para grupos de itens relacionados.
Navegação de menu, breadcrumbs e paginação são listas.

---

## Foco e Navegação por Teclado {#foco}

**Regras invioláveis:**
- Nunca remova o outline sem substituir por alternativa visível
- A ordem de foco deve seguir a ordem visual lógica
- Todo elemento interativo alcançável por mouse deve ser alcançável por teclado

```css
/* NÃO faça isso */
*:focus { outline: none; }

/* Faça isso */
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Esconde o outline para interação por mouse mas mantém para teclado */
:focus:not(:focus-visible) { outline: none; }
```

**Focus trap para modais:**
```js
// Quando modal abre: mova foco para o primeiro elemento focável interno
// Quando modal fecha: retorne foco ao elemento que abriu o modal
// Tab dentro do modal: cicle entre os elementos focáveis internos
const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
```

**`tabIndex`:**
- `tabIndex="0"`: inclui na ordem natural de tab
- `tabIndex="-1"`: focável via JS, mas não via tab
- `tabIndex > 0`: evite — quebra a ordem natural e cria problemas imprevisíveis

---

## ARIA — Quando e Como Usar {#aria}

**Regra n°1**: Nunca use ARIA se o elemento HTML nativo já carrega a semântica.

**Quando ARIA é necessário:**
- Widgets customizados sem equivalente HTML (`combobox`, `treeview`, `slider`)
- Regiões que atualizam dinamicamente (`role="status"`, `aria-live`)
- Relacionamentos que o HTML não expressa (`aria-controls`, `aria-owns`)
- Labels quando texto visual não é suficiente (`aria-label`, `aria-labelledby`)

```html
<!-- Live region para mensagens dinâmicas -->
<div role="status" aria-live="polite" aria-atomic="true">
  <!-- Conteúdo atualizado via JS -->
</div>

<!-- Alert para erros ou avisos urgentes -->
<div role="alert" aria-live="assertive">
  <!-- Erros de validação, mensagens críticas -->
</div>

<!-- Describedby para contexto adicional -->
<input
  id="email"
  aria-describedby="email-hint email-error"
  aria-invalid="true"
/>
<p id="email-hint">Use seu email corporativo</p>
<p id="email-error" role="alert">Email inválido</p>
```

---

## Padrões por Componente {#padrões}

### Botão
```html
<button type="button" aria-pressed="false">Favoritar</button>
<!-- Se o botão tem só ícone: -->
<button type="button" aria-label="Favoritar item">
  <svg aria-hidden="true">...</svg>
</button>
```

### Modal / Dialog
```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-desc"
>
  <h2 id="modal-title">Confirmar exclusão</h2>
  <p id="modal-desc">Esta ação não pode ser desfeita.</p>
  <button autofocus>Cancelar</button>
  <button>Excluir</button>
</div>
```

### Menu de Navegação
```html
<nav aria-label="Navegação principal">
  <ul role="list">
    <li><a href="/" aria-current="page">Início</a></li>
    <li><a href="/sobre">Sobre</a></li>
  </ul>
</nav>
```

### Input com Erro
```html
<div>
  <label for="name">Nome completo</label>
  <input
    id="name"
    type="text"
    aria-required="true"
    aria-invalid="true"
    aria-describedby="name-error"
  />
  <p id="name-error" role="alert">Nome é obrigatório</p>
</div>
```

### Accordion
```html
<div>
  <h3>
    <button
      aria-expanded="false"
      aria-controls="section-1"
      id="accordion-1"
    >
      Título da seção
    </button>
  </h3>
  <div
    id="section-1"
    role="region"
    aria-labelledby="accordion-1"
    hidden
  >
    Conteúdo...
  </div>
</div>
```

### Toggle / Switch
```html
<button
  role="switch"
  aria-checked="false"
  aria-label="Notificações por email"
>
  <span aria-hidden="true">Off</span>
</button>
```

### Carousel / Slideshow

**Armadilha frequente:** usar `role="tablist"` / `role="tab"` para dots de navegação.
Isso é correto apenas se cada slide for um painel independente sem relação sequencial.
Para slideshows lineares (o caso mais comum), a estrutura correta é diferente.

**Quando usar cada abordagem:**

| Situação | Estrutura correta |
|---|---|
| Slides são etapas sequenciais (onboarding, tour) | `role="group"` + `aria-current` nos botões |
| Slides são tabs independentes (produto A / B / C) | `role="tablist"` + `role="tab"` + `role="tabpanel"` |

**Estrutura correta para slideshow sequencial:**
```html
<section
  aria-roledescription="carousel"
  aria-label="Destaques do produto"
>
  <!-- Live region: anuncia mudança de slide para screen readers -->
  <div aria-live="polite" aria-atomic="true" class="sr-only" id="carousel-status">
    Slide 2 de 4
  </div>

  <!-- Container dos slides -->
  <div aria-live="off">
    <div
      role="group"
      aria-roledescription="slide"
      aria-label="1 de 4"
      id="slide-1"
    >
      <!-- Conteúdo do slide -->
    </div>
    <!-- Slides ocultos: aria-hidden="true" quando não ativos -->
    <div role="group" aria-roledescription="slide" aria-label="2 de 4" id="slide-2" aria-hidden="true">
      ...
    </div>
  </div>

  <!-- Controles de navegação -->
  <button type="button" aria-label="Slide anterior" id="prev">‹</button>
  <button type="button" aria-label="Próximo slide" id="next">›</button>

  <!-- Dots: botões simples com aria-current — NÃO role="tab" -->
  <div role="group" aria-label="Selecionar slide">
    <button type="button" aria-label="Ir para slide 1" aria-current="true"></button>
    <button type="button" aria-label="Ir para slide 2" aria-current="false"></button>
    <button type="button" aria-label="Ir para slide 3" aria-current="false"></button>
  </div>

  <!-- Controle de reprodução automática (se aplicável) -->
  <button type="button" aria-label="Pausar rotação automática" id="autoplay-toggle">
    ⏸
  </button>
</section>
```

**Navegação por teclado obrigatória:**
- `←` / `→`: navega entre slides
- `Enter` / `Space` nos dots: vai para aquele slide
- Se houver autoplay: `Escape` pausa; pausa também ao receber foco

**Atualize a live region via JS ao mudar de slide:**
```js
document.getElementById('carousel-status').textContent =
  `Slide ${current} de ${total}`;
```

---

## Foco em Conteúdo Dinâmico {#foco-dinâmico}

A skill cobre focus trap para modais. Este padrão é diferente: mover foco
**após** uma mudança de conteúdo dentro da mesma página, sem navegação.

**Quando aplicar:**
- Transição de slide / etapa de onboarding
- Resultado de busca ou filtro substituindo o conteúdo
- Step wizard que troca o painel visível
- Qualquer atualização de região que o usuário precisa ler

**Padrão correto: `tabIndex="-1"` + `ref.focus()` com timing pós-transição**

```html
<!-- O heading ou região que recebe o foco programático -->
<h2 id="slide-heading" tabindex="-1">Título do Slide 2</h2>
```

```js
function goToSlide(index) {
  // 1. Atualiza o conteúdo / estado
  setCurrentSlide(index);

  // 2. Aguarda a transição terminar ANTES de mover o foco
  //    (se mover antes, o screen reader anuncia o estado anterior)
  const TRANSITION_DURATION = 300; // ms — deve casar com sua animação CSS

  setTimeout(() => {
    const heading = document.getElementById('slide-heading');
    heading?.focus({ preventScroll: false });
  }, TRANSITION_DURATION);
}
```

**Por que `tabIndex="-1"` no heading:**
- Headings não são focáveis por padrão via teclado
- `tabIndex="-1"` os torna focáveis **programaticamente** (via JS)
- mas **não** os insere na ordem de Tab — o usuário não chega até eles pressionando Tab acidentalmente
- Ao receber foco, o screen reader lê o heading e orienta o usuário no novo contexto

**Timing é crítico:**
- Foco antes da transição → screen reader lê o conteúdo antigo
- Foco depois da transição → screen reader lê o conteúdo novo corretamente
- Use `requestAnimationFrame` em vez de `setTimeout` quando não há animação CSS:

```js
// Sem animação: aguarda um frame de renderização
requestAnimationFrame(() => {
  requestAnimationFrame(() => heading?.focus());
});
```

**Não aplique em:**
- Atualizações menores onde o contexto não muda (ex: contador incrementando)
- Conteúdo que se atualiza em background sem ação do usuário
- Live regions com `aria-live` — elas já anunciam sem precisar de foco

---

## Contraste e Cor {#contraste}

**Nunca use cor como único meio de transmitir informação.**
Sempre combine com: ícone, padrão, texto, forma.

```css
/* Exemplo: erro não só vermelho */
.field-error {
  color: #c0392b;          /* cor */
  border-color: #c0392b;   /* borda */
  /* + ícone de erro no markup */
  /* + texto descritivo */
}
```

**Ferramentas de verificação:**
- `contrast-checker.polished.io`
- DevTools → Acessibilidade → Cor
- `axe` browser extension

---

## Motion e Animação {#motion}

**Obrigatório em toda animação:**

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Não apenas desabilite — ofereça uma alternativa estática significativa.
(Ex: em vez de animação de entrada, mostre o estado final diretamente.)

---

## Checklist Rápida {#checklist}

Use em qualquer entrega com componente interativo:

- [ ] Todo `<img>` tem `alt` (vazio `alt=""` para imagens decorativas)
- [ ] Todo `<input>`, `<select>`, `<textarea>` tem `<label>` associado
- [ ] Nenhum `div` ou `span` tem `onClick` sem `role` e `tabIndex`
- [ ] Foco visível em todos os elementos interativos
- [ ] Nenhum `outline: none` sem alternativa
- [ ] Contraste 4.5:1 verificado para texto
- [ ] Mensagens de erro são descritivas e anunciadas (`role="alert"`)
- [ ] Modais têm `role="dialog"`, `aria-modal`, retorno de foco ao fechar
- [ ] Animações respeitam `prefers-reduced-motion`
- [ ] `lang` definido no `<html>`
- [ ] Hierarquia de headings sem saltos
- [ ] Carousels usam `aria-roledescription="carousel"`, live region e `aria-current` (não `role="tab"`) nos dots
- [ ] Conteúdo dinâmico (slides, steps) move foco para heading com `tabIndex="-1"` após a transição
