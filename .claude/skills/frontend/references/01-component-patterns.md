# 01 — Padrões de Componentes

## Índice
1. [Identidade Visual](#identidade-visual) ← leia sempre que houver entrega visual
2. [Anatomia de um componente](#anatomia)
3. [Padrões de composição](#composição)
4. [Componentes controlados vs não-controlados](#controlados)
5. [Extração de lógica](#extração)
6. [Quando quebrar em partes menores](#quebrar)

---

## Identidade Visual

**Esta seção é o antídoto para padrões de IA genéricos.**

### Antes de escolher qualquer estilo, defina:
1. **Propósito**: Que problema esta interface resolve? Para quem?
2. **Tom**: Escolha um extremo e execute com precisão:
   - Brutalmente minimal / Maximalismo editorial / Retro-futurista
   - Orgânico/natural / Luxo/refinado / Lúdico/brinquedo
   - Brutalista/cru / Art déco/geométrico / Industrial/utilitário
   - Suave/pastel / Técnico/dados / Íntimo/tipográfico
3. **Diferencial**: O que torna esta entrega inesquecível?

### Tipografia (o erro mais comum)
- **Nunca** use Inter, Roboto, Arial ou fontes de sistema como escolha criativa
- Essas fontes são neutras por design — usadas por padrão, não por intenção
- Escolha uma display font com caráter + uma body font refinada
- Pares que funcionam: `Playfair Display` + `Source Serif 4`,
  `Syne` + `DM Sans`, `Space Grotesk` + `Literata`, `Bebas Neue` + `Karla`,
  `Fraunces` + `Figtree`, `Cabinet Grotesk` + `Lora`
- Varie entre claro e escuro, serifa e sans — nunca repita a mesma combinação

### Cor
- Commit em uma paleta coesa com variáveis CSS para consistência
- Cores dominantes com acentos nítidos > distribuição uniforme e tímida
- Evite gradiente roxo/azul em fundo branco — é o padrão de IA mais reconhecível
- Explore: verde oliva + terracota, azul-marinha + âmbar, cinza-frio + coral,
  preto + amarelo elétrico, off-white + borgonha

### Composição espacial
- Assimetria intencional > simetria segura
- Sobreposições, fluxo diagonal, elementos que quebram o grid
- Espaço negativo generoso OU densidade controlada — não o meio-termo
- Layouts inesperados para contextos inesperados

### Backgrounds e atmosfera
- Crie profundidade em vez de cores sólidas neutras
- Explore: noise textures sutis, padrões geométricos, gradientes de malha,
  sombras dramáticas, bordas decorativas, grain overlays
- Nunca adicione decoração sem função — cada elemento deve justificar sua presença

---

## Anatomia de um Componente {#anatomia}

Todo componente tem quatro responsabilidades separáveis:

```
┌─────────────────────────────────────┐
│  Interface (props / inputs)         │ ← o que entra
├─────────────────────────────────────┤
│  Estado interno (se houver)         │ ← o que muda
├─────────────────────────────────────┤
│  Lógica derivada / transformações   │ ← o que é calculado
├─────────────────────────────────────┤
│  Apresentação (markup + estilos)    │ ← o que é renderizado
└─────────────────────────────────────┘
```

Mantenha essas camadas separadas mesmo em componentes simples.
A separação facilita teste, reutilização e refatoração.

---

## Padrões de Composição {#composição}

### Composição explícita (children / slots)
Prefira composição a configuração por props quando o conteúdo interno
for variável ou desconhecido.

```
// Ruim: prop-driven interno
<Card title="..." body="..." footer="..." />

// Bom: composição por children
<Card>
  <Card.Header>...</Card.Header>
  <Card.Body>...</Card.Body>
  <Card.Footer>...</Card.Footer>
</Card>
```

### Compound Components
Para grupos de componentes relacionados que compartilham estado implícito:
- `Select` + `Option`
- `Accordion` + `AccordionItem`
- `Tabs` + `TabPanel`

O componente pai gerencia estado; filhos consomem via contexto/slot.

### Render Props / Scoped Slots
Para lógica reutilizável com apresentação variável:
- Listas virtualizadas
- Componentes de dados (paginação, filtros)
- Wrappers de animação

---

## Controlados vs Não-controlados {#controlados}

**Controlado**: o estado vive fora do componente (prop + callback).
Use quando o pai precisa reagir a mudanças ou sincronizar com outros elementos.

**Não-controlado**: o estado vive dentro do componente (ref ou interno).
Use para componentes isolados onde o pai só precisa do valor final.

**Híbrido (padrão recomendado para inputs)**:
- Aceite `value` opcional; se fornecido, opere como controlado
- Se não fornecido, gerencie estado interno (não-controlado)
- Sempre exponha `defaultValue` para o modo não-controlado

---

## Extração de Lógica {#extração}

Extraia para hooks/composables/funções quando:
- A lógica se repetir em 2+ componentes
- O componente ultrapassar ~150 linhas
- A lógica tiver dependências de efeito colateral (API, timer, evento)
- A lógica for testável independentemente da apresentação

Nunca extraia só para "organizar" — extração prematura cria indireção desnecessária.

---

## Quando Quebrar em Partes Menores {#quebrar}

Quebre quando qualquer um destes for verdadeiro:
- O componente renderiza mais de uma "ideia visual" independente
- Há duas ou mais ramificações de renderização (`if/else` no markup)
- O mesmo trecho de markup aparece 2+ vezes dentro do componente
- Um trecho poderia ter um nome de componente sem precisar de contexto externo
- O componente ultrapassa ~200 linhas (markup + lógica + estilos)

Não quebre só por tamanho — um componente de 300 linhas coeso é melhor
que 5 componentes de 60 linhas sem responsabilidade clara.
