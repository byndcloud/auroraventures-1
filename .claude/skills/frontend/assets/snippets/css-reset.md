# Snippet — CSS Reset Moderno

Reset baseado em boas práticas atuais (2024+).
Copie diretamente em `globals.css`, `reset.css` ou equivalente.

```css
/*
  CSS Reset Moderno
  Baseado em: Andy Bell's Modern CSS Reset + Josh Comeau's CSS Reset
  com adições para acessibilidade e performance.
*/

/* 1. Box model consistente em todos os elementos */
*,
*::before,
*::after {
  box-sizing: border-box;
}

/* 2. Remove margens padrão */
* {
  margin: 0;
}

/* 3. Melhora renderização de texto e consistência de cor */
body {
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* 4. Mídias como elementos de bloco com max-width responsivo */
img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

/* 5. Herança de fonte para inputs (não herdam por padrão) */
input,
button,
textarea,
select {
  font: inherit;
}

/* 6. Evita overflow em textos longos */
p,
h1,
h2,
h3,
h4,
h5,
h6 {
  overflow-wrap: break-word;
}

/* 7. Melhora layout de root para sticky footer e min-height */
html,
body {
  height: 100%;
}

#root,
#__next {
  isolation: isolate;
  min-height: 100%;
}

/* 8. Remove decoração de lista apenas quando list-style é none
   (preserva semântica para screen readers) */
ul[role='list'],
ol[role='list'] {
  list-style: none;
  padding: 0;
}

/* 9. Scroll suave — apenas se não houver preferência por redução de movimento */
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}

/* 10. Foco visível para navegação por teclado */
:focus-visible {
  outline: 2px solid var(--color-border-focus, Highlight);
  outline-offset: 2px;
}

/* Remove outline para interação por mouse, mantém para teclado */
:focus:not(:focus-visible) {
  outline: none;
}

/* 11. Reduz movimento para quem prefere */
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

/* 12. Tipografia base responsiva */
html {
  /* Escala de 16px no mobile até 18px no desktop */
  font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  line-height: 1.5;
}

/* 13. Previne quebras inesperadas em tabelas */
table {
  border-collapse: collapse;
}

/* 14. Remove estilos de summary > details */
summary {
  cursor: pointer;
}

/* 15. Remove estilos padrão de fieldset */
fieldset {
  border: none;
  padding: 0;
}
```

## Notas de uso

**`isolation: isolate` no root:**
Cria um novo stacking context, evitando problemas de z-index com portals
e componentes de overlay.

**`ul[role='list']`:**
Usar `list-style: none` remove a semântica de lista no VoiceOver/Safari.
A solução é aplicar o reset apenas quando `role="list"` está explícito no markup,
sinalizando ao browser que a semântica foi preservada intencionalmente.

**`focus-visible`:**
O seletor `:focus-visible` aplica o outline apenas para navegação por teclado,
mantendo a UX para mouse enquanto garante acessibilidade para teclado.
