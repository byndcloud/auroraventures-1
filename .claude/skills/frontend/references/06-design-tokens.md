# 06 — Design Tokens

## Índice
1. [Conceito e camadas](#conceito)
2. [Escala primitiva](#primitiva)
3. [Tokens semânticos](#semânticos)
4. [Tokens de componente](#componente)
5. [Dark mode](#dark-mode)
6. [Tipografia como token](#tipografia)
7. [Adaptação de design systems externos](#adaptação)

---

## Conceito e Camadas {#conceito}

Design tokens são variáveis nomeadas que codificam decisões de design.
Organizados em três camadas:

```
┌─────────────────────────────────────────────────┐
│  Tokens de Componente                           │
│  --button-bg, --input-border-focus              │
├─────────────────────────────────────────────────┤
│  Tokens Semânticos                              │
│  --color-primary, --color-surface, --space-md   │
├─────────────────────────────────────────────────┤
│  Escala Primitiva                               │
│  --blue-500: #3b82f6, --space-4: 1rem           │
└─────────────────────────────────────────────────┘
```

**Regras de referência:**
- Primitivos referenciam valores brutos
- Semânticos referenciam primitivos
- Componentes referenciam semânticos
- Nunca pule camadas (componente → primitivo é um cheiro de problema)

---

## Escala Primitiva {#primitiva}

A escala primitiva não é usada diretamente no código de componentes.
Ela é a "fonte da verdade" que alimenta os tokens semânticos.

```css
:root {
  /* Cor — escala de 50 a 950 */
  --blue-50:  #eff6ff;
  --blue-100: #dbeafe;
  --blue-200: #bfdbfe;
  --blue-300: #93c5fd;
  --blue-400: #60a5fa;
  --blue-500: #3b82f6;
  --blue-600: #2563eb;
  --blue-700: #1d4ed8;
  --blue-800: #1e40af;
  --blue-900: #1e3a8a;
  --blue-950: #172554;

  /* Cinza neutro */
  --gray-50:  #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;
  --gray-950: #030712;

  /* Espaçamento — base 4px */
  --space-0:   0;
  --space-1:   0.25rem;  /* 4px  */
  --space-2:   0.5rem;   /* 8px  */
  --space-3:   0.75rem;  /* 12px */
  --space-4:   1rem;     /* 16px */
  --space-5:   1.25rem;  /* 20px */
  --space-6:   1.5rem;   /* 24px */
  --space-8:   2rem;     /* 32px */
  --space-10:  2.5rem;   /* 40px */
  --space-12:  3rem;     /* 48px */
  --space-16:  4rem;     /* 64px */
  --space-20:  5rem;     /* 80px */
  --space-24:  6rem;     /* 96px */

  /* Border radius */
  --radius-none: 0;
  --radius-sm:   0.25rem;
  --radius-md:   0.375rem;
  --radius-lg:   0.5rem;
  --radius-xl:   0.75rem;
  --radius-2xl:  1rem;
  --radius-full: 9999px;
}
```

---

## Tokens Semânticos {#semânticos}

Nomeados por **função**, não por aparência.
`--color-primary` é melhor que `--color-blue`.

```css
:root {
  /* Cores — superficie */
  --color-bg:           var(--gray-50);
  --color-bg-elevated:  var(--white);
  --color-bg-overlay:   rgba(0, 0, 0, 0.5);

  /* Cores — superfície de componentes */
  --color-surface:      var(--white);
  --color-surface-hover: var(--gray-50);
  --color-surface-active: var(--gray-100);

  /* Cores — marca */
  --color-primary:       var(--blue-600);
  --color-primary-hover: var(--blue-700);
  --color-primary-text:  var(--white);

  /* Cores — texto */
  --color-text:          var(--gray-900);
  --color-text-secondary: var(--gray-600);
  --color-text-disabled:  var(--gray-400);
  --color-text-inverse:   var(--white);

  /* Cores — borda */
  --color-border:        var(--gray-200);
  --color-border-strong: var(--gray-400);
  --color-border-focus:  var(--blue-500);

  /* Cores — estado */
  --color-success:       #16a34a;
  --color-success-bg:    #f0fdf4;
  --color-warning:       #d97706;
  --color-warning-bg:    #fffbeb;
  --color-error:         #dc2626;
  --color-error-bg:      #fef2f2;
  --color-info:          #0284c7;
  --color-info-bg:       #f0f9ff;

  /* Espaçamento — aliases semânticos */
  --space-xs:  var(--space-1);
  --space-sm:  var(--space-2);
  --space-md:  var(--space-4);
  --space-lg:  var(--space-6);
  --space-xl:  var(--space-8);
  --space-2xl: var(--space-12);
  --space-3xl: var(--space-16);

  /* Viewport — use dvh/svh para layouts full-screen mobile */
  /* 100vh é inconsistente: ignora a barra do browser em iOS/Android */
  --screen-h:     100dvh;  /* Ajusta dinamicamente — padrão recomendado */
  --screen-h-min: 100svh;  /* Mais conservador: sempre cabe com a barra visível */

  /* Radius */
  --radius-component: var(--radius-md);
  --radius-card:      var(--radius-xl);
  --radius-pill:      var(--radius-full);

  /* Sombra */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);

  /* Z-index — escala nomeada */
  --z-base:    0;
  --z-raised:  1;
  --z-dropdown: 100;
  --z-sticky:  200;
  --z-overlay: 300;
  --z-modal:   400;
  --z-toast:   500;
}
```

---

## Tokens de Componente {#componente}

Para componentes com muitas variações, crie tokens próprios que
referenciam os semânticos:

```css
/* Botão */
.button {
  --button-bg:          var(--color-primary);
  --button-bg-hover:    var(--color-primary-hover);
  --button-text:        var(--color-primary-text);
  --button-padding-x:   var(--space-md);
  --button-padding-y:   var(--space-sm);
  --button-radius:      var(--radius-component);

  background: var(--button-bg);
  color: var(--button-text);
  padding: var(--button-padding-y) var(--button-padding-x);
  border-radius: var(--button-radius);
}

/* Variante — sobrescreve apenas os tokens locais */
.button--ghost {
  --button-bg:       transparent;
  --button-bg-hover: var(--color-surface-hover);
  --button-text:     var(--color-primary);
}

/* Tamanho — sobrescreve apenas espaçamento */
.button--sm {
  --button-padding-x: var(--space-sm);
  --button-padding-y: var(--space-xs);
}
```

---

## Dark Mode {#dark-mode}

Estratégia com `@media` + atributo de tema:

```css
/* Light mode (padrão) */
:root {
  --color-bg:     #ffffff;
  --color-text:   #111827;
  --color-border: #e5e7eb;
  color-scheme: light;
}

/* Dark mode via preferência do sistema */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:     #0f172a;
    --color-text:   #f1f5f9;
    --color-border: #1e293b;
    color-scheme: dark;
  }
}

/* Dark mode forçado via classe (toggle manual) */
[data-theme="dark"] {
  --color-bg:     #0f172a;
  --color-text:   #f1f5f9;
  --color-border: #1e293b;
  color-scheme: dark;
}
```

**Toggle de tema:**
```js
const toggle = () => {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
};

// Inicialização sem flash de tema errado
const saved = localStorage.getItem('theme');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.dataset.theme = saved ?? (systemDark ? 'dark' : 'light');
```

---

## Tipografia como Token {#tipografia}

```css
:root {
  /* Famílias */
  --font-sans:    'Syne', system-ui, sans-serif;
  --font-serif:   'Fraunces', Georgia, serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;

  /* Escala modular (ratio 1.25 — major third) */
  --text-xs:   0.75rem;    /* 12px */
  --text-sm:   0.875rem;   /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg:   1.125rem;   /* 18px */
  --text-xl:   1.25rem;    /* 20px */
  --text-2xl:  1.5rem;     /* 24px */
  --text-3xl:  1.875rem;   /* 30px */
  --text-4xl:  2.25rem;    /* 36px */
  --text-5xl:  3rem;       /* 48px */
  --text-6xl:  3.75rem;    /* 60px */

  /* Peso */
  --font-normal: 400;
  --font-medium: 500;
  --font-bold:   700;

  /* Line height */
  --leading-tight:  1.25;
  --leading-snug:   1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose:  2;

  /* Letter spacing */
  --tracking-tight:  -0.025em;
  --tracking-normal:  0;
  --tracking-wide:    0.025em;
  --tracking-wider:   0.05em;
  --tracking-widest:  0.1em;
}
```

---

## Adaptação de Design Systems Externos {#adaptação}

Quando o projeto usa um design system externo (Radix, shadcn, Material),
mapeie seus tokens para a estrutura semântica local:

```css
/* Exemplo: adaptando tokens do Radix UI para o sistema local */
:root {
  --color-primary: var(--accent-9);      /* Radix accent */
  --color-bg:      var(--gray-1);        /* Radix gray scale */
  --color-text:    var(--gray-12);
  --color-border:  var(--gray-6);
}
```

Isso cria uma camada de indireção que permite:
- Trocar o design system sem alterar o código dos componentes
- Manter consistência semântica independente de qual sistema está por baixo
