# Checklist de Lançamento

Verifique cada item antes de deploy em produção.
Marque com [x] ao completar.

---

## Reuso de componentes (passo bloqueante)

- [ ] Listei componentes existentes via `glob src/components/**/*.tsx` antes de criar qualquer JSX novo
- [ ] Nenhum componente novo duplica funcionalidade de um existente. Cada novo componente tem responsabilidade que não existia
- [ ] Botões usam `<Button>` de `@/components/ui/button` — não há classes `.btn-*` inline nem `<button>` cru com estilo recriado
- [ ] Topbar via `<AppTopbar>` — nenhum `<header>` próprio em rota pública
- [ ] Logo via `<BrandLogo>` — sem `<Image src="/logo-*.png">` direto
- [ ] Tokens CSS de `globals.css` usados para cor/espaçamento/sombra. Hardcode somente: `#0044FF`, `#111`, `#666`, `white`, `var(--brand-gradient)`

---

## Performance

- [ ] Imagens em formato moderno (WebP/AVIF) com fallbacks
- [ ] Todas as imagens têm `width` e `height` definidos (previne CLS)
- [ ] Imagens abaixo da dobra têm `loading="lazy"`
- [ ] Imagem hero tem `<link rel="preload">` e `fetchpriority="high"`
- [ ] Fontes web têm `font-display: swap` ou `optional`
- [ ] Fontes críticas têm `<link rel="preload">`
- [ ] Bundle JS principal < 300KB gzipped
- [ ] Code splitting aplicado em rotas não-críticas
- [ ] Nenhuma dependência óbvia não utilizada
- [ ] LCP < 2.5s (verificado no Lighthouse ou WebPageTest)
- [ ] CLS < 0.1
- [ ] INP < 200ms em interações principais

---

## Acessibilidade

- [ ] Lighthouse acessibilidade ≥ 90
- [ ] `lang` definido no `<html>` com idioma correto
- [ ] Hierarquia de headings sem saltos (h1 → h2 → h3)
- [ ] Apenas um `<h1>` por página
- [ ] Todos os `<img>` têm `alt` (ou `alt=""` para decorativas)
- [ ] Todos os controles de formulário têm `<label>` associado
- [ ] Foco visível em todos os elementos interativos
- [ ] Contraste de texto verificado (4.5:1 mínimo)
- [ ] Navegação completa por teclado testada
- [ ] Modais e overlays têm focus trap correto
- [ ] Animações respeitam `prefers-reduced-motion`
- [ ] Landmarks HTML5 presentes (`<main>`, `<nav>`, `<header>`, `<footer>`)

---

## SEO e Metadados

- [ ] `<title>` único e descritivo em cada página
- [ ] `<meta name="description">` com 120–160 caracteres
- [ ] Open Graph: `og:title`, `og:description`, `og:image`, `og:url`
- [ ] Twitter Card: `twitter:card`, `twitter:title`, `twitter:image`
- [ ] `<link rel="canonical">` onde necessário
- [ ] `robots.txt` presente e correto
- [ ] `sitemap.xml` presente e enviado ao Search Console
- [ ] URLs semânticas e legíveis

---

## Segurança

- [ ] HTTPS configurado com certificado válido
- [ ] Headers de segurança: CSP, X-Frame-Options, X-Content-Type-Options
- [ ] Nenhuma chave de API exposta no código front-end
- [ ] Inputs do usuário sanitizados antes de inserção no DOM
- [ ] Links externos têm `rel="noopener noreferrer"`
- [ ] Dependências sem vulnerabilidades conhecidas (`npm audit`)

---

## Cross-browser / Cross-device

- [ ] Testado em Chrome, Firefox e Safari
- [ ] Testado em mobile iOS e Android
- [ ] Layout funcional em 320px (mínimo)
- [ ] Layout funcional em 1920px (máximo comum)
- [ ] Sem conteúdo cortado em orientação landscape mobile

---

## Monitoramento

- [ ] Error tracking configurado (Sentry ou equivalente)
- [ ] Analytics configurado e verificado
- [ ] 404 e páginas de erro com layout correto
- [ ] Logs de console sem erros ou warnings desnecessários

---

## Conteúdo

- [ ] Nenhum texto placeholder (Lorem ipsum, "teste", "em breve")
- [ ] Todas as imagens são as finais (sem assets de desenvolvimento)
- [ ] Links verificados (sem 404)
- [ ] Formulários testados end-to-end
- [ ] Emails transacionais testados (se aplicável)
