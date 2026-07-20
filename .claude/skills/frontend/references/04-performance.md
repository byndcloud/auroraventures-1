# 04 — Performance

## Índice
1. [Core Web Vitals](#cwv)
2. [Loading](#loading)
3. [Rendering](#rendering)
4. [Bundle e dependências](#bundle)
5. [Imagens e fontes](#assets)
6. [Diagnóstico](#diagnóstico)

---

## Core Web Vitals {#cwv}

Os três sinais que o Google usa como critério de rankeamento e que
medem experiência real do usuário:

| Métrica | O que mede               | Meta      | Ruim      |
|---------|--------------------------|-----------|-----------|
| **LCP** | Largest Contentful Paint | ≤ 2.5s    | > 4s      |
| **INP** | Interaction to Next Paint| ≤ 200ms   | > 500ms   |
| **CLS** | Cumulative Layout Shift  | ≤ 0.1     | > 0.25    |

### LCP (maior elemento visível)
Causas frequentes de LCP ruim:
- Imagem hero sem `<link rel="preload">`
- Fonte web bloqueando renderização
- Servidor lento (TTFB > 600ms)
- CSS crítico não inlined

```html
<!-- Preload da imagem hero -->
<link rel="preload" as="image" href="hero.jpg" fetchpriority="high" />

<!-- Preload de fonte crítica -->
<link rel="preload" as="font" type="font/woff2" href="/fonts/brand.woff2" crossorigin />
```

### INP (responsividade a interações)
Causas frequentes:
- JavaScript bloqueando a main thread por > 50ms
- Event handlers pesados sem debounce/throttle
- Reflows forçados (leitura + escrita de layout no mesmo tick)

```js
// Ruim: força reflow em loop
elements.forEach(el => {
  const h = el.offsetHeight; // leitura de layout
  el.style.height = h + 10 + 'px'; // escrita de layout
});

// Bom: separa leituras de escritas (FastDOM pattern)
const heights = elements.map(el => el.offsetHeight); // batch leitura
elements.forEach((el, i) => el.style.height = heights[i] + 10 + 'px'); // batch escrita
```

### CLS (estabilidade visual)
Causas frequentes:
- `<img>` sem `width` e `height` definidos
- Fontes web causando FOUT/FOIT
- Conteúdo inserido dinamicamente acima do conteúdo existente

```html
<!-- Sempre defina dimensões para reservar espaço -->
<img src="photo.jpg" width="800" height="600" alt="..." />
```

```css
/* Previne FOUT com font-display */
@font-face {
  font-family: 'BrandFont';
  src: url('/fonts/brand.woff2') format('woff2');
  font-display: swap; /* opcional: 'optional' para zero CLS */
}
```

---

## Loading {#loading}

### Code Splitting
Divida o bundle por rota ou feature, carregue sob demanda:

```js
// Importação dinâmica (agnóstica de bundler)
const HeavyComponent = () => import('./HeavyComponent');
const AdminDashboard  = () => import('./pages/AdminDashboard');
```

### Lazy Loading
```html
<!-- Imagens abaixo da dobra -->
<img src="..." loading="lazy" decoding="async" alt="..." />

<!-- Iframes (mapas, vídeos) -->
<iframe src="..." loading="lazy"></iframe>
```

### Resource Hints
```html
<!-- DNS lookup antecipado para domínios externos -->
<link rel="dns-prefetch" href="//fonts.googleapis.com" />

<!-- Conexão completa antecipada -->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

<!-- Pré-carrega próxima navegação provável -->
<link rel="prefetch" href="/about" />

<!-- Carrega recurso crítico com alta prioridade -->
<link rel="preload" as="script" href="/critical.js" />
```

### Cache Strategy
- Assets com hash no nome → `Cache-Control: max-age=31536000, immutable`
- HTML → `Cache-Control: no-cache` (valida sempre)
- API → `Cache-Control: max-age=60, stale-while-revalidate=300`

---

## Rendering {#rendering}

### Quando usar cada estratégia

| Estratégia | Quando usar                                      |
|------------|--------------------------------------------------|
| **SSG**    | Conteúdo estático, blogs, marketing, docs        |
| **SSR**    | Conteúdo personalizado, SEO crítico, e-commerce  |
| **CSR**    | Apps autenticados, dashboards, ferramentas        |
| **ISR**    | Conteúdo semi-estático com revalidação periódica |

### Evite reflows forçados
Propriedades que causam reflow (caro): `width`, `height`, `top`, `left`,
`margin`, `padding`, `border`, `offsetHeight`, `scrollTop`, `getBoundingClientRect`.

Propriedades que só afetam compositing (barato): `transform`, `opacity`, `filter`.

```css
/* Animação cara: causa reflow */
@keyframes slide-bad {
  from { left: -100px; }
  to   { left: 0; }
}

/* Animação eficiente: só compositing */
@keyframes slide-good {
  from { transform: translateX(-100px); }
  to   { transform: translateX(0); }
}
```

### `will-change` — use com moderação
```css
/* Use apenas quando a animação está prestes a acontecer */
.card:hover { will-change: transform; }

/* Não use preventivamente em tudo — cria camadas desnecessárias */
/* ERRADO: */
* { will-change: transform; }
```

---

## Bundle e Dependências {#bundle}

### Antes de adicionar uma dependência, pergunte:
1. O browser nativo resolve? (Fetch, IntersectionObserver, ResizeObserver)
2. CSS resolve sem JS?
3. A funcionalidade cabe em < 20 linhas?
4. Qual é o tamanho gzipped? (bundlephobia.com)

### Tree shaking
```js
// Ruim: importa toda a biblioteca
import _ from 'lodash';
const result = _.groupBy(items, 'category');

// Bom: importa só o necessário
import groupBy from 'lodash/groupBy';
```

### Análise de bundle
```bash
# Vite
npx vite-bundle-visualizer

# Webpack
npx webpack-bundle-analyzer stats.json

# Next.js
ANALYZE=true next build
```

**Sinais de alerta no bundle:**
- Módulo único > 100KB gzipped
- Mesma dependência duplicada em múltiplos chunks
- `moment.js` (use `date-fns` ou `Temporal API`)
- `lodash` completo (importe funções individualmente)

---

## Imagens e Fontes {#assets}

### Imagens
- Prefira WebP com fallback JPEG/PNG
- Use `<picture>` para art direction
- Sempre `width` + `height` para evitar CLS
- `loading="lazy"` para tudo abaixo da dobra
- `fetchpriority="high"` para o LCP candidate

### Fontes
```css
/* Subsetting: carregue só os caracteres necessários */
@font-face {
  font-family: 'Brand';
  src: url('/fonts/brand-latin.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0020-007E, U+00C0-00FF; /* Latin + Latin Extended */
}
```

**Fontes do Google Fonts com subset:**
```html
<!-- &display=swap evita FOIT; subset reduz download -->
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700&display=swap&subset=latin" rel="stylesheet" />
```

---

## Diagnóstico {#diagnóstico}

**Ferramentas de medição:**
- Lighthouse (DevTools ou CLI) — relatório completo
- WebPageTest.org — real devices, throttling real
- Chrome DevTools → Performance → gravação de interação
- `performance.measure()` — profiling customizado no código

**Sinais que exigem ação imediata:**
- LCP > 4s
- Bundle JS > 300KB gzipped na rota principal
- Fonte web sem `font-display`
- Imagens sem dimensões definidas
- Nenhum code splitting em app com múltiplas rotas
