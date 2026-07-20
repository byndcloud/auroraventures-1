# 05 — Animação e Motion

## Índice
1. [Princípios de motion significativo](#princípios)
2. [prefers-reduced-motion — obrigatório](#reduced-motion)
3. [CSS Transitions](#transitions)
4. [CSS Keyframes](#keyframes)
5. [JS Animation — quando e como](#js-animation)
6. [Micro-interações](#micro-interações)
7. [Orquestração e sequências](#orquestração)
8. [Timing functions de referência](#timing)

---

## Princípios de Motion Significativo {#princípios}

**Animação deve comunicar, não decorar.**

Antes de adicionar qualquer animação, pergunte:
1. Esta animação ajuda o usuário a entender o que aconteceu?
2. Ela indica causa e efeito (onde o elemento veio, para onde foi)?
3. Ela cria continuidade entre estados (não deixa o usuário desorientado)?

Se a resposta for "não" para todas, não animate.

**Hierarquia de impacto:**
- **Alto impacto**: entrada de modal/drawer, transição entre páginas, feedback de ação crítica
- **Médio impacto**: hover em cards, expansão de accordion, reveal de conteúdo
- **Baixo impacto**: mudança de cor em botão, fade de tooltip
- **Evite**: rotação decorativa sem função, bounce repetitivo, parallax agressivo

**Uma animação bem orquestrada > dez animações simultâneas.**
Concentre o esforço no momento de maior impacto na interface.

---

## prefers-reduced-motion — Obrigatório {#reduced-motion}

Aplique em **todas** as animações, sem exceção:

```css
/* Reset global — inclua no início do projeto */
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

**Alternativa preferível ao reset global** — desabilite por animação,
oferecendo fallback significativo:

```css
.hero-image {
  animation: fade-in 0.6s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .hero-image {
    animation: none;
    opacity: 1; /* Mostra estado final diretamente */
  }
}
```

**Em JavaScript:**
```js
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

if (!prefersReduced.matches) {
  // Anima
} else {
  // Aplica estado final diretamente
}
```

---

## CSS Transitions {#transitions}

Use para mudanças de **estado** — hover, focus, active, toggled.

```css
/* Sempre especifique propriedades — não use 'all' */
.button {
  background-color: var(--color-primary);
  transform: translateY(0);
  box-shadow: none;
  transition:
    background-color 150ms ease,
    transform 150ms ease,
    box-shadow 150ms ease;
}

.button:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.button:active {
  transform: translateY(0);
  box-shadow: none;
}
```

**Por que não usar `transition: all`:**
- Anima propriedades que não deveriam ser animadas (ex: `display`)
- Impacto de performance imprevisível
- Dificulta debugging

---

## CSS Keyframes {#keyframes}

Use para animações contínuas ou de entrada/saída com estados intermediários.

```css
/* Entrada com fade + slide — padrão elegante */
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Aplicação com variável para delay progressivo */
.stagger-item {
  animation: fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--index, 0) * 80ms);
}

/* No markup: style="--index: 0", "--index: 1", etc. */
```

```css
/* Loading skeleton */
@keyframes shimmer {
  to { background-position: 200% center; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-secondary) 25%,
    var(--color-bg-tertiary) 50%,
    var(--color-bg-secondary) 75%
  );
  background-size: 200% auto;
  animation: shimmer 1.5s linear infinite;
}
```

---

## JS Animation — Quando e Como {#js-animation}

**Use JS quando CSS não é suficiente:**
- Animações dependentes de dados (gráficos, physics)
- Animações orquestradas com lógica complexa
- Scroll-based animations (IntersectionObserver ou scroll timeline)
- Animações que precisam ser interrompidas / revertidas com precisão

**Web Animations API (nativa, zero dependência):**
```js
element.animate(
  [
    { opacity: 0, transform: 'translateY(20px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ],
  {
    duration: 400,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    fill: 'forwards'
  }
);
```

**IntersectionObserver para scroll reveal:**
```js
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // Anima uma vez
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);

document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
```

**Bibliotecas recomendadas (quando justificado):**
- `motion` (ex Framer Motion) — React, gestures, layout animations
- `GSAP` — orquestrações complexas, SVG, ScrollTrigger
- `@vueuse/motion` — Vue

---

## Micro-interações {#micro-interações}

### Feedback de botão
```css
.button {
  transition: transform 100ms ease, background-color 150ms ease;
}
.button:active { transform: scale(0.97); }
```

### Checkbox animado
```css
.checkbox__mark {
  transform: scale(0);
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.checkbox:checked + .checkbox__mark {
  transform: scale(1);
}
```

### Input focus
```css
.input {
  border-bottom: 1px solid var(--color-border);
  transition: border-color 200ms ease;
}
.input::after {
  content: '';
  display: block;
  width: 0;
  height: 2px;
  background: var(--color-primary);
  transition: width 250ms ease;
}
.input:focus-within::after { width: 100%; }
```

---

## Orquestração e Sequências {#orquestração}

**Stagger com CSS custom properties:**
```html
<ul>
  <li style="--i: 0">Item 1</li>
  <li style="--i: 1">Item 2</li>
  <li style="--i: 2">Item 3</li>
</ul>
```
```css
li {
  animation: fade-up 0.35s ease both;
  animation-delay: calc(var(--i) * 60ms);
}
```

**Princípio de entrada de modal:**
1. Overlay: `opacity: 0 → 1` em 200ms
2. Dialog: `opacity: 0, scale(0.95) → opacity: 1, scale(1)` em 250ms com 50ms de delay
3. Saída: reverso, mais rápido (150ms e 180ms)

```css
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

---

## Timing Functions de Referência {#timing}

| Nome          | Cubic Bezier                     | Uso                                   |
|---------------|----------------------------------|---------------------------------------|
| Ease standard | `cubic-bezier(0.4, 0, 0.2, 1)`  | Transições gerais                     |
| Ease out      | `cubic-bezier(0, 0, 0.2, 1)`    | Entradas (do estado inativo ao ativo) |
| Ease in       | `cubic-bezier(0.4, 0, 1, 1)`    | Saídas (do ativo ao inativo)          |
| Spring        | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Checkboxes, toggles, pops         |
| Snappy        | `cubic-bezier(0.16, 1, 0.3, 1)` | Slides, drawers, modais               |

**Durações de referência:**
- Micro (feedback imediato): 80–150ms
- Transição (estado → estado): 200–300ms
- Entrada de elemento: 300–500ms
- Transição de página: 400–600ms

Acima de 600ms começa a parecer lento para o usuário.
