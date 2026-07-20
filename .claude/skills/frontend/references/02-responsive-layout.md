# 02 — Layout Responsivo

## Índice
1. [Princípios fundamentais](#princípios)
2. [CSS Grid](#grid)
3. [Flexbox](#flexbox) ← inclui armadilha de alinhamento em flex column
4. [Breakpoints intrínsecos vs extrínsecos](#breakpoints)
5. [Container Queries](#container-queries)
6. [Tipografia fluida](#tipografia-fluida)
7. [Unidades de viewport dinâmicas](#viewport-units) ← dvh / svh / lvh
8. [Imagens responsivas](#imagens)
9. [Spacing fluido](#spacing)

---

## Princípios Fundamentais {#princípios}

**Mobile-first como padrão de escrita**
Escreva estilos base para mobile e sobreponha para telas maiores.
`min-width` queries são mais compostas que `max-width`.

**Layout intrínseco primeiro**
Antes de adicionar breakpoints, pergunte: CSS Grid ou Flexbox com
`auto-fit`/`wrap` resolve sem media query? Na maioria das vezes, sim.

**Nunca hardcode larguras em px para containers**
Use `max-width` + `width: 100%` + `padding` horizontal. O container
respira sozinho sem media queries.

---

## CSS Grid {#grid}

### auto-fit vs auto-fill
```css
/* auto-fit: colapsa colunas vazias — itens crescem para preencher */
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));

/* auto-fill: mantém colunas fantasma — útil para alinhar com grade fixa */
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
```

Use `auto-fit` para grids de cards onde você quer que os itens se expandam.
Use `auto-fill` quando precisar que novos itens apareçam na posição prevista.

### Grid areas nomeadas
```css
.layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 280px 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}

@media (width < 768px) {
  .layout {
    grid-template-areas:
      "header"
      "main"
      "sidebar"
      "footer";
    grid-template-columns: 1fr;
  }
}
```

### Subgrid (quando disponível)
```css
/* Alinha células de filhos com a grade do pai */
.card-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
.card { display: grid; grid-row: span 3; grid-template-rows: subgrid; }
```

---

## Flexbox {#flexbox}

Use Flexbox para:
- Distribuição de itens em **uma dimensão** (linha ou coluna)
- Alinhamento vertical/horizontal dentro de containers
- Navegação, toolbars, grupos de botões

Prefira Grid quando o layout for **bidimensional**.

```css
/* Centro absoluto — não use posicionamento para isso */
.center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Espaçamento igual com wrap automático */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Empurrar item para o final */
.card-footer {
  display: flex;
  flex-direction: column;
  .cta { margin-top: auto; } /* Empurra o botão para baixo */
}
```

### Armadilha: filho com `max-width` em flex column

Este é um dos bugs de alinhamento mais frequentes e mais sutis.
Quando um filho tem `max-width` menor que o container em um flex column,
ele se ancora à esquerda por padrão — mesmo que seu texto interno seja centralizado.

```css
/* ❌ Bug: .description fica ancorado à esquerda */
.hero {
  display: flex;
  flex-direction: column;
  /* align-items não definido → padrão é stretch */
}

.hero__description {
  max-width: 24rem;
  text-align: center; /* O texto está centrado, mas o bloco não */
}
```

O resultado visual é um heading centralizado (que ocupa a largura total)
e uma descrição cujo bloco começa na esquerda, criando desalinhamento
que não é imediatamente óbvio mas é perceptível.

**Duas soluções equivalentes:**

```css
/* Solução A: centraliza todos os filhos no container pai */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center; /* ← resolve para todos os filhos */
}

/* Solução B: centraliza apenas o filho problemático */
.hero__description {
  max-width: 24rem;
  margin-inline: auto; /* ← equivalente a margin: 0 auto */
  text-align: center;
}
```

**Quando usar cada solução:**
- `align-items: center` no pai → quando todos os filhos devem ser centralizados
- `margin-inline: auto` no filho → quando só aquele elemento precisa de centralização

**Regra prática:** sempre que um filho de flex column tiver `max-width`
menor que o container, pergunte: "onde este bloco deve estar horizontalmente?"
Se a resposta for "centrado", adicione `margin-inline: auto` ou `align-items: center` no pai.

---

## Breakpoints Intrínsecos vs Extrínsecos {#breakpoints}

**Extrínsecos** (viewport-based): use para mudanças de layout macro.
```css
@media (width >= 768px) { ... }
@media (width >= 1200px) { ... }
```

Pontos de quebra recomendados (agnósticos de framework):
- `480px` — smartphones em paisagem / small devices
- `768px` — tablets portrait / fim do mobile-first
- `1024px` — tablets landscape / início do desktop
- `1280px` — desktop padrão
- `1536px` — telas largas

**Intrínsecos** (content-based): prefira quando possível.
```css
/* O grid quebra quando os itens não cabem mais — sem media query */
grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
```

**Regra prática**: se você precisar de mais de 3 breakpoints para um componente,
o problema é de composição, não de breakpoints.

---

## Container Queries {#container-queries}

Use quando o componente deve se adaptar ao **container pai**, não ao viewport.
Essencial para componentes reutilizáveis em diferentes contextos.

```css
/* Define o container de referência */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

/* Adapta o componente ao tamanho do container */
@container card (width >= 400px) {
  .card { flex-direction: row; }
  .card__image { width: 160px; }
}
```

Prefira container queries a media queries para componentes de UI isolados.

---

## Tipografia Fluida {#tipografia-fluida}

`clamp()` para tamanhos que escalam entre dois pontos sem breakpoints:

```css
/* clamp(mínimo, valor-ideal, máximo) */
/* Ideal usa vw para escalar com o viewport */
h1 { font-size: clamp(1.75rem, 4vw + 1rem, 3.5rem); }
h2 { font-size: clamp(1.375rem, 3vw + 0.75rem, 2.5rem); }
p  { font-size: clamp(1rem, 1.5vw + 0.5rem, 1.125rem); }

/* Espaçamento entre linhas adaptativo */
h1 { line-height: clamp(1.1, 1.1 + 0.5vw, 1.3); }
p  { line-height: 1.65; } /* Texto corrido: fixo entre 1.5–1.7 */
```

**Ferramenta útil**: `utopia.fyi` para gerar escalas fluidas.

---

## Unidades de Viewport Dinâmicas {#viewport-units}

Em mobile, a barra de endereço do browser aparece e desaparece durante o scroll,
mudando a altura visível do viewport. `100vh` usa a altura **máxima** (barra recolhida),
o que causa overflow em layouts full-screen quando a barra está visível.

As unidades dinâmicas resolvem isso:

| Unidade | Comportamento | Quando usar |
|---------|--------------|-------------|
| `dvh` | Atualiza conforme a barra aparece/desaparece | **Padrão recomendado** para layouts full-screen |
| `svh` | Sempre o menor viewport (barra visível) | Quando quer garantir que nada fique oculto pela barra |
| `lvh` | Sempre o maior viewport (barra recolhida) | Equivale ao comportamento antigo de `vh` |
| `vh`  | Comportamento inconsistente por browser | Evite em layouts full-screen mobile |

```css
/* ❌ Causa overflow em mobile quando a barra está visível */
.hero {
  min-height: 100vh;
}

/* ✅ Ajusta dinamicamente conforme a barra aparece/desaparece */
.hero {
  min-height: 100dvh;
}

/* ✅ Garante que o conteúdo sempre caiba sem ocultar nada */
.onboarding-screen {
  min-height: 100svh;
}
```

**As mesmas unidades existem para largura:** `dvw`, `svw`, `lvw` — mas são raramente
necessárias pois a largura do viewport não muda com barras de interface.

**Suporte:** `dvh`/`svh`/`lvh` têm suporte amplo desde 2023 (Chrome 108+, Safari 15.4+,
Firefox 101+). Use sem polyfill para projetos modernos.

---

## Imagens Responsivas {#imagens}

```html
<!-- srcset para resolução -->
<img
  src="hero-800.jpg"
  srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1600.jpg 1600w"
  sizes="(width < 768px) 100vw, (width < 1200px) 50vw, 800px"
  alt="Descrição da imagem"
  loading="lazy"
  decoding="async"
/>

<!-- Art direction com picture -->
<picture>
  <source media="(width >= 768px)" srcset="hero-wide.jpg" />
  <img src="hero-mobile.jpg" alt="Descrição" />
</picture>
```

Sempre defina `width` e `height` no HTML para evitar CLS (layout shift).

---

## Spacing Fluido {#spacing}

```css
:root {
  /* Escala de espaçamento fluido */
  --space-xs:  clamp(0.25rem, 0.5vw, 0.5rem);
  --space-sm:  clamp(0.5rem,  1vw,   1rem);
  --space-md:  clamp(1rem,    2vw,   1.5rem);
  --space-lg:  clamp(1.5rem,  3vw,   2.5rem);
  --space-xl:  clamp(2rem,    5vw,   4rem);
  --space-2xl: clamp(3rem,    8vw,   6rem);
}
```

Use as variáveis de espaçamento de forma consistente para criar ritmo visual
que escala naturalmente com o viewport.
