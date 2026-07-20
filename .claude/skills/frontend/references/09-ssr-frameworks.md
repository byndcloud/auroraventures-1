# 09 — Frameworks SSR

## Índice
1. [Next.js App Router](#nextjs-app-router)
   - [Server vs Client Components](#server-vs-client)
   - [Diretiva `"use client"`](#use-client)
   - [Fontes: `next/font` vs `@import`](#fontes)
   - [Animações CSS e hidratação](#animações-hidratação)
   - [Armadilhas comuns](#armadilhas-nextjs)
2. [Nuxt 3](#nuxt)
3. [SvelteKit](#sveltekit)
4. [Princípios gerais SSR](#princípios-ssr)

---

## Next.js App Router {#nextjs-app-router}

O App Router (Next.js 13+) inverte o padrão: **todos os componentes são
Server Components por padrão**. Client Components são a exceção, não a regra.

### Server vs Client Components {#server-vs-client}

| Capacidade | Server Component | Client Component |
|---|---|---|
| Acessa banco de dados, filesystem | ✅ | ❌ |
| Usa `useState`, `useEffect`, hooks | ❌ | ✅ |
| Manipula eventos (onClick, onChange) | ❌ | ✅ |
| Usa APIs do browser (window, localStorage) | ❌ | ✅ |
| Acessa Context API | ❌ | ✅ |
| Reduz bundle JS enviado ao cliente | ✅ | ❌ |
| Renderiza no servidor (sem JS no cliente) | ✅ | ❌ |

**Regra prática para decidir:**
1. O componente precisa de interatividade ou estado? → Client Component
2. O componente acessa dados no servidor? → Server Component
3. É puramente estrutural/visual sem lógica? → Server Component (padrão)

**Estratégia de composição: empurre `"use client"` para as folhas da árvore**
```
// ✅ Correto: Server Component contém Client Component isolado
// app/page.tsx (Server Component — sem diretiva)
export default function Page() {
  return (
    <article>
      <h1>Título</h1>           {/* Renderizado no servidor */}
      <LikeButton />             {/* Client Component — só o botão */}
    </article>
  );
}

// components/LikeButton.tsx
"use client";
export function LikeButton() {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>...</button>;
}
```

```
// ❌ Problema: marca a página inteira como Client Component
// app/page.tsx
"use client"; // ← torna tudo abaixo um Client Component desnecessariamente
export default function Page() {
  const [liked, setLiked] = useState(false);
  return (
    <article>
      <h1>Título</h1>
      <button onClick={() => setLiked(!liked)}>...</button>
    </article>
  );
}
```

### Diretiva `"use client"` {#use-client}

**Quando é obrigatória:**
- Qualquer hook do React (`useState`, `useEffect`, `useContext`, `useRef`, etc.)
- Event handlers (`onClick`, `onChange`, `onSubmit`, etc.)
- APIs do browser (`window`, `document`, `localStorage`, `navigator`)
- Componentes de terceiros que já usam hooks (verifique se a lib exporta Client Components)

**Quando NÃO colocar:**
- Componentes puramente visuais sem lógica de estado
- Componentes que só recebem dados e renderizam markup
- Layouts, páginas de conteúdo estático

**`"use client"` é uma fronteira, não uma tag por componente:**
Uma vez que um componente tem `"use client"`, todos os seus filhos
importados também se tornam Client Components — mesmo sem a diretiva.
A diretiva define o limite do bundle do cliente.

```tsx
// Componentes de terceiros que usam estado interno
// precisam de um wrapper "use client"
"use client";
import { SomethingInteractive } from 'some-library';
export { SomethingInteractive }; // Re-exporta como Client Component
```

### Fontes: `next/font` vs `@import` {#fontes}

**Sempre use `next/font` — nunca `@import` ou `<link>` de Google Fonts.**

Motivos:
- Zero layout shift: a fonte é carregada com `font-display: optional` por padrão
- Sem requisição externa em runtime (hospedagem local automática)
- CSS variables prontas para uso em qualquer parte da aplicação

```tsx
// app/layout.tsx
import { Syne, Fraunces } from 'next/font/google';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',        // ou 'optional' para zero CLS
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  axes: ['SOFT', 'WONK'], // Variable font axes, se disponível
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* globals.css — usa as variáveis definidas em layout.tsx */
body {
  font-family: var(--font-sans), system-ui, sans-serif;
}

h1, h2, h3 {
  font-family: var(--font-serif);
}
```

**Para fontes locais:**
```tsx
import localFont from 'next/font/local';

const brandFont = localFont({
  src: [
    { path: '../public/fonts/brand-400.woff2', weight: '400' },
    { path: '../public/fonts/brand-700.woff2', weight: '700' },
  ],
  variable: '--font-brand',
});
```

### Animações CSS e Hidratação {#animações-hidratação}

Animações CSS que dependem de estado (classes adicionadas por JS) podem
causar **flash de conteúdo não estilizado (FOUC)** durante a hidratação.

**Problema:**
```tsx
// ❌ Causa FOUC: a classe só é adicionada após hidratação
"use client";
export function Hero() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true); // Só roda no cliente
  }, []);

  return <div className={visible ? 'is-visible' : ''}>...</div>;
}
```

**Soluções:**

```tsx
// Solução A: use CSS puro para animações de entrada
// (não depende de estado JS — funciona no servidor)
// globals.css:
// @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
// .hero { animation: fade-in 0.4s ease both; }

// Solução B: se precisar de estado, use suppressHydrationWarning
// para evitar mismatch entre servidor e cliente
<div suppressHydrationWarning className={visible ? 'is-visible' : ''}>
```

```tsx
// Solução C: componente de animação que só renderiza no cliente
"use client";
import { useEffect, useState } from 'react';

export function Animated({ children, className = '' }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={mounted ? `${className} is-mounted` : className}>
      {children}
    </div>
  );
}
```

**Regra:** prefira animações CSS puras que não dependem de classes adicionadas
por JS. Para entrance animations, use `@keyframes` direto no componente,
não condicionais de estado.

### Armadilhas Comuns do App Router {#armadilhas-nextjs}

**`localStorage` / `sessionStorage` em Server Components:**
```tsx
// ❌ Erro: APIs do browser não existem no servidor
export default function Page() {
  const theme = localStorage.getItem('theme'); // ReferenceError
}

// ✅ Correto: leia no cliente, passe como prop ou use cookies no servidor
"use client";
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('theme') : 'light'
  );
}
```

**Contexto em Server Components:**
```tsx
// ❌ Context não funciona em Server Components
import { useTheme } from './ThemeContext'; // Erro
export default function Page() {
  const { theme } = useTheme(); // Não funciona
}

// ✅ Passe dados via props ou use cookies/headers no servidor
import { cookies } from 'next/headers';
export default function Page() {
  const theme = cookies().get('theme')?.value ?? 'light';
  return <div data-theme={theme}>...</div>;
}
```

**`useEffect` e `useLayoutEffect`:**
`useLayoutEffect` lança warning no servidor. Use `useEffect` e, se precisar
do comportamento síncrono, adicione a verificação:
```tsx
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

---

## Nuxt 3 {#nuxt}

Equivalentes Nuxt para os padrões do App Router:

| Next.js | Nuxt 3 |
|---|---|
| Server Component (padrão) | `<script setup>` sem `client-only` |
| `"use client"` | `<ClientOnly>` wrapper ou `.client.vue` suffix |
| `next/font` | `@nuxt/fonts` module |
| `useEffect` para dados | `useFetch`, `useAsyncData` |
| `cookies()` no servidor | `useCookie()` composable |

```vue
<!-- Componente que só renderiza no cliente -->
<ClientOnly>
  <InteractiveChart />
  <template #fallback>
    <ChartSkeleton /> <!-- Renderizado no servidor -->
  </template>
</ClientOnly>
```

---

## SvelteKit {#sveltekit}

| Conceito | SvelteKit |
|---|---|
| Server-side data loading | `+page.server.ts` (load function) |
| Client-side interactivity | `+page.svelte` com `onMount` |
| Compartilhado servidor/cliente | `+page.ts` (load function universal) |
| Fontes | `<link>` no `app.html` ou `vite-plugin-webfont-dl` |

```ts
// +page.server.ts — roda apenas no servidor
export async function load({ params, cookies }) {
  const data = await db.query(params.id);
  return { data };
}
```

---

## Princípios Gerais SSR {#princípios-ssr}

Aplicáveis a qualquer framework com renderização no servidor:

**1. Separação de ambientes**
Código que usa APIs do browser deve ser guardado por `typeof window !== 'undefined'`
ou equivalente do framework. Nunca assuma que `window`, `document` ou `navigator`
existem fora de um contexto de cliente.

**2. Hidratação sem mismatch**
O markup renderizado no servidor deve ser idêntico ao que o cliente produziria
no primeiro render. Fontes de mismatch comuns:
- Datas formatadas com locale do servidor ≠ locale do cliente
- IDs gerados aleatoriamente no servidor
- Dados de `localStorage` usados no render inicial

**3. Fontes via API do framework**
Todo framework SSR tem uma forma de carregar fontes sem FOUC e sem
requisição externa em runtime. Use sempre a API nativa do framework
em vez de `@import` do Google Fonts.

**4. Estado que precisa existir antes da hidratação**
Tema, idioma, preferências de usuário — esses dados precisam estar
disponíveis no servidor (via cookies ou headers) para evitar FOUC.
Não leia de `localStorage` no render inicial.
