# Snippet — Padrões UI Recorrentes

Cada padrão inclui: HTML semântico, CSS base e notas de acessibilidade.
Adapte à sintaxe do framework em uso — a estrutura e os atributos ARIA permanecem.

---

## Modal / Dialog

```html
<!-- Trigger -->
<button type="button" id="modal-trigger" aria-haspopup="dialog">
  Abrir modal
</button>

<!-- Modal (inicialmente hidden) -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  id="modal"
  hidden
>
  <div class="modal__backdrop" aria-hidden="true"></div>
  <div class="modal__content">
    <header class="modal__header">
      <h2 id="modal-title">Título do modal</h2>
      <button
        type="button"
        class="modal__close"
        aria-label="Fechar modal"
      >
        <svg aria-hidden="true"><!-- ícone X --></svg>
      </button>
    </header>
    <div class="modal__body">
      <!-- Conteúdo -->
    </div>
    <footer class="modal__footer">
      <button type="button">Cancelar</button>
      <button type="button">Confirmar</button>
    </footer>
  </div>
</div>
```

```css
.modal__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: var(--z-overlay, 300);
}

.modal__content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--z-modal, 400);
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  width: min(560px, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
}
```

**Comportamento JS obrigatório:**
- Ao abrir: remove `hidden`, move foco para primeiro elemento focável interno
- Ao fechar: adiciona `hidden`, retorna foco ao trigger
- `Escape` fecha o modal
- Tab cicla apenas dentro do modal (focus trap)

---

## Drawer / Sidebar

```html
<aside
  role="dialog"
  aria-modal="true"
  aria-labelledby="drawer-title"
  class="drawer"
  data-state="closed"
>
  <h2 id="drawer-title" class="sr-only">Menu de navegação</h2>
  <div class="drawer__inner">
    <!-- Conteúdo -->
  </div>
</aside>

<div class="drawer__overlay" aria-hidden="true" data-drawer-close></div>
```

```css
.drawer {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: min(380px, 85vw);
  background: var(--color-surface);
  z-index: var(--z-modal, 400);
  transform: translateX(-100%);
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer[data-state="open"] {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .drawer { transition: none; }
}
```

---

## Toast / Notification

```html
<!-- Container de toasts — no final do body -->
<div
  role="region"
  aria-label="Notificações"
  aria-live="polite"
  aria-atomic="false"
  class="toast-region"
  id="toast-region"
></div>

<!-- Template de um toast (inserido via JS) -->
<div role="status" class="toast toast--success">
  <svg aria-hidden="true"><!-- ícone --></svg>
  <p>Alterações salvas com sucesso</p>
  <button type="button" aria-label="Fechar notificação" class="toast__close">
    <svg aria-hidden="true"><!-- X --></svg>
  </button>
</div>
```

```css
.toast-region {
  position: fixed;
  bottom: var(--space-lg);
  right: var(--space-lg);
  z-index: var(--z-toast, 500);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-width: 380px;
  width: calc(100% - 2 * var(--space-lg));
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  animation: toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(100%); }
  to   { opacity: 1; transform: translateX(0); }
}
```

**Nota a11y:** `aria-live="polite"` anuncia o toast sem interromper o leitor de tela.
Use `aria-live="assertive"` apenas para erros críticos.

---

## Skeleton Loader

```html
<div class="skeleton-card" aria-busy="true" aria-label="Carregando conteúdo">
  <div class="skeleton skeleton--avatar"></div>
  <div class="skeleton-lines">
    <div class="skeleton skeleton--line" style="--w: 70%"></div>
    <div class="skeleton skeleton--line" style="--w: 45%"></div>
  </div>
</div>
```

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-hover) 25%,
    var(--color-surface-active) 50%,
    var(--color-surface-hover) 75%
  );
  background-size: 200% auto;
  border-radius: var(--radius-md);
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  to { background-position: -200% center; }
}

.skeleton--avatar { width: 40px; height: 40px; border-radius: 50%; }
.skeleton--line   { height: 14px; width: var(--w, 100%); }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; opacity: 0.5; }
}
```

---

## Accordion

```html
<div class="accordion">
  <div class="accordion__item">
    <h3 class="accordion__heading">
      <button
        type="button"
        class="accordion__trigger"
        aria-expanded="false"
        aria-controls="panel-1"
        id="trigger-1"
      >
        Título da seção
        <svg class="accordion__icon" aria-hidden="true"><!-- chevron --></svg>
      </button>
    </h3>
    <div
      id="panel-1"
      role="region"
      aria-labelledby="trigger-1"
      class="accordion__panel"
      hidden
    >
      <div class="accordion__body">Conteúdo...</div>
    </div>
  </div>
</div>
```

```css
.accordion__trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.accordion__icon {
  transition: transform 200ms ease;
}

.accordion__trigger[aria-expanded="true"] .accordion__icon {
  transform: rotate(180deg);
}

.accordion__panel {
  overflow: hidden;
}
```

---

## Carousel / Slideshow

**Estrutura semântica correta para slideshow sequencial.**
Veja `references/03-accessibility.md` → "Carousel" para a decisão entre
`role="tablist"` vs. `aria-current` (resumo: use `aria-current` para slides lineares).

```html
<section
  class="carousel"
  aria-roledescription="carousel"
  aria-label="Destaques"
>
  <!-- Live region: anuncia mudança para screen readers sem interromper -->
  <p class="sr-only" aria-live="polite" aria-atomic="true" id="carousel-status">
    Slide 1 de 3
  </p>

  <!-- Viewport -->
  <div class="carousel__viewport" aria-live="off">
    <div class="carousel__track" id="carousel-track">

      <div class="carousel__slide" role="group" aria-roledescription="slide"
           aria-label="1 de 3" id="slide-1">
        <h3 tabindex="-1" id="slide-1-heading">Título do slide 1</h3>
        <!-- conteúdo -->
      </div>

      <div class="carousel__slide" role="group" aria-roledescription="slide"
           aria-label="2 de 3" id="slide-2" aria-hidden="true">
        <h3 tabindex="-1" id="slide-2-heading">Título do slide 2</h3>
      </div>

      <div class="carousel__slide" role="group" aria-roledescription="slide"
           aria-label="3 de 3" id="slide-3" aria-hidden="true">
        <h3 tabindex="-1" id="slide-3-heading">Título do slide 3</h3>
      </div>

    </div>
  </div>

  <!-- Controles de prev/next -->
  <button type="button" class="carousel__btn carousel__btn--prev"
          id="carousel-prev" aria-label="Slide anterior">
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5"
            fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <button type="button" class="carousel__btn carousel__btn--next"
          id="carousel-next" aria-label="Próximo slide">
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5"
            fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <!-- Dots: aria-current="true" no ativo — NÃO role="tab" -->
  <div class="carousel__dots" role="group" aria-label="Selecionar slide">
    <button type="button" aria-label="Ir para slide 1" aria-current="true"
            class="carousel__dot carousel__dot--active" data-slide="0"></button>
    <button type="button" aria-label="Ir para slide 2" aria-current="false"
            class="carousel__dot" data-slide="1"></button>
    <button type="button" aria-label="Ir para slide 3" aria-current="false"
            class="carousel__dot" data-slide="2"></button>
  </div>
</section>
```

```css
.carousel {
  position: relative;
  overflow: hidden;
}

.carousel__viewport {
  overflow: hidden;
}

.carousel__track {
  display: flex;
  transition: transform 350ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .carousel__track {
    transition: none;
  }
}

.carousel__slide {
  flex: 0 0 100%;
  min-width: 0; /* Evita overflow de conteúdo interno */
}

.carousel__btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease, opacity 150ms ease;
}

.carousel__btn--prev { left: var(--space-sm); }
.carousel__btn--next { right: var(--space-sm); }

.carousel__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.carousel__dots {
  display: flex;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.carousel__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-border-strong);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 200ms ease, transform 200ms ease;
}

.carousel__dot--active,
.carousel__dot[aria-current="true"] {
  background: var(--color-primary);
  transform: scale(1.25);
}
```

```js
// Lógica de carousel — agnóstico de framework
class Carousel {
  constructor(el) {
    this.el = el;
    this.track = el.querySelector('#carousel-track');
    this.slides = el.querySelectorAll('.carousel__slide');
    this.dots = el.querySelectorAll('.carousel__dot');
    this.status = el.querySelector('#carousel-status');
    this.current = 0;
    this.total = this.slides.length;

    el.querySelector('#carousel-prev').addEventListener('click', () => this.prev());
    el.querySelector('#carousel-next').addEventListener('click', () => this.next());
    this.dots.forEach((dot, i) => dot.addEventListener('click', () => this.goTo(i)));

    // Navegação por teclado nas setas
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });
  }

  goTo(index) {
    // Atualiza slides
    this.slides[this.current].setAttribute('aria-hidden', 'true');
    this.dots[this.current].setAttribute('aria-current', 'false');
    this.dots[this.current].classList.remove('carousel__dot--active');

    this.current = index;

    this.slides[this.current].removeAttribute('aria-hidden');
    this.dots[this.current].setAttribute('aria-current', 'true');
    this.dots[this.current].classList.add('carousel__dot--active');

    // Move o track
    this.track.style.transform = `translateX(-${this.current * 100}%)`;

    // Atualiza live region
    this.status.textContent = `Slide ${this.current + 1} de ${this.total}`;

    // Move foco para o heading do slide após a transição
    // (ver 03-accessibility.md → Foco em Conteúdo Dinâmico)
    const TRANSITION_MS = 350;
    setTimeout(() => {
      const heading = this.slides[this.current].querySelector('[tabindex="-1"]');
      heading?.focus({ preventScroll: false });
    }, TRANSITION_MS);
  }

  prev() { if (this.current > 0) this.goTo(this.current - 1); }
  next() { if (this.current < this.total - 1) this.goTo(this.current + 1); }
}

// Inicialização
document.querySelectorAll('.carousel').forEach(el => new Carousel(el));
```

**Nota:** para autoplay, adicione `pause on hover` e `pause on focus` (qualquer foco
dentro do carousel pausa a rotação). Exponha um botão de play/pause com
`aria-label` dinâmico ("Pausar rotação" / "Retomar rotação").

---

## Classe utilitária `.sr-only` (visível apenas para screen readers)

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Permite que o elemento receba foco e se torne visível */
.sr-only-focusable:focus,
.sr-only-focusable:active {
  position: static;
  width: auto;
  height: auto;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```
