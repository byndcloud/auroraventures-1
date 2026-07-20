# 07 — Padrões de Estado

## Índice
1. [Quatro tipos de estado](#tipos)
2. [Estado local](#local)
3. [Estado compartilhado](#compartilhado)
4. [Estado de servidor](#servidor)
5. [Estado de URL](#url)
6. [Máquinas de estado finito](#fsm)
7. [Critérios para escolher ferramentas](#ferramentas)

---

## Quatro Tipos de Estado {#tipos}

Antes de implementar gerenciamento de estado, classifique:

| Tipo         | Onde vive          | Exemplos                                      |
|--------------|--------------------|-----------------------------------------------|
| **Local**    | Componente         | isOpen, inputValue, activeTab                 |
| **Compartilhado** | Múltiplos componentes | usuário autenticado, carrinho, tema  |
| **Servidor** | Cache local de dado remoto | lista de produtos, perfil, config   |
| **URL**      | Query string / path | página atual, filtros, ordenação              |

**Regra de ouro**: mantenha o estado no nível mais baixo possível.
Eleve apenas quando outro componente precisar do mesmo estado.

---

## Estado Local {#local}

Use para tudo que é exclusivo de um componente e não precisa persistir
entre navegações.

```
Padrão básico (agnóstico de framework):

state = {
  isOpen: false,
  inputValue: '',
  selectedIndex: 0
}

Atualização: crie um novo objeto em vez de mutar o existente
(imutabilidade facilita debug e previne bugs sutis)
```

**Quando estado local basta:**
- Visibilidade de tooltip / dropdown / modal iniciado localmente
- Valor de input antes de submissão
- Estado de hover / focus
- Passo atual de um wizard multi-step contido em um componente

**Quando NÃO usar estado local:**
- O dado precisa ser acessado por um componente irmão (não-pai)
- O dado precisa persistir ao desmontar o componente
- O dado é compartilhado com mais de 2 níveis de profundidade

---

## Estado Compartilhado {#compartilhado}

### Padrão: Elevar o estado (lifting state up)
O caminho mais simples — o estado vive no ancestral comum mais próximo.

```
Antes (estado duplicado):
  ┌── ComponenteA (estado: count)
  └── ComponenteB (estado: count) ← dessincronizado

Depois (estado elevado):
  ┌── Pai (estado: count)
  │   ├── ComponenteA (recebe count via prop)
  │   └── ComponenteB (recebe count + callback)
```

### Padrão: Context / Provide-Inject
Use quando o estado precisa cruzar muitos níveis sem "prop drilling".

```
Bom uso de context:
- Tema atual (light/dark)
- Preferências do usuário
- Idioma / internacionalização
- Estado de autenticação

Mau uso de context:
- Estado que muda frequentemente (causa re-renders em cascata)
- Estado específico de uma feature que poderia ficar local
```

### Padrão: Reducer
Útil quando o estado tem transições complexas e interdependentes.

```
Estrutura de um reducer:
state = { ... }
action = { type: 'NOME_DA_ACAO', payload: ... }
reducer(state, action) → newState

Regras:
- Reducer deve ser uma função pura (sem side effects)
- Sempre retorna novo objeto (não muta)
- O type deve descrever O QUE aconteceu, não O QUE FAZER
  ✓ 'ITEM_ADICIONADO'
  ✗ 'ADICIONAR_ITEM'
```

---

## Estado de Servidor {#servidor}

Estado de servidor é dado remoto com uma cópia em cache local.
**Não confunda com estado de aplicação** — eles têm ciclos de vida diferentes.

**Características:**
- Assíncrono por natureza (loading, error, data)
- Pode ficar desatualizado (stale)
- Pode ser compartilhado entre múltiplos componentes
- Precisa de estratégia de revalidação

**Estados de uma requisição:**
```
idle → loading → success
                → error → retry → ...
```

**Modelo de dados recomendado:**
```
{
  data: T | null,
  error: Error | null,
  status: 'idle' | 'loading' | 'success' | 'error',
  isLoading: boolean,    // status === 'loading'
  isError: boolean,      // status === 'error'
  isSuccess: boolean     // status === 'success'
}
```

**Estratégias de cache:**
- **stale-while-revalidate**: retorna dado em cache (mesmo que antigo) e
  revalida em background. Melhor UX, dado pode estar defasado.
- **cache-then-network**: mostra cache, depois atualiza com rede.
- **network-first**: vai na rede, cai para cache se falhar.

**Bibliotecas para gestão de estado de servidor:**
- `TanStack Query` (React, Vue, Solid) — padrão da indústria
- `SWR` (React) — mais simples, menos features
- `Apollo Client` (GraphQL)

---

## Estado de URL {#url}

**Use a URL como estado quando:**
- O usuário deve poder copiar/compartilhar o link com o estado preservado
- O estado deve ser preservado no histórico do browser (voltar/avançar)
- Filtros, ordenação, paginação, aba ativa em página pública

**Nunca use a URL para:**
- Estado temporário de UI (hover, focus, isOpen de modal)
- Dados sensíveis
- Estado que muda a cada keystroke (debounce antes de atualizar)

**Implementação:**
```
query string: /produtos?categoria=eletronicos&pagina=2&ordem=preco-asc
path param:   /produtos/eletronicos
hash:         /docs#instalação (posição na página)
```

**Padrão de sincronização:**
1. Na inicialização: leia a URL e popule o estado local
2. Em cada mudança de estado: atualize a URL (pushState ou replaceState)
3. No evento popstate (voltar/avançar): releia a URL e sincronize o estado

---

## Máquinas de Estado Finito {#fsm}

Use quando um componente tem estados exclusivos e transições bem definidas.
Previne estados impossíveis e bugs de "estado intermediário".

```
Exemplo: formulário de submissão

Estados possíveis:
  idle → editing → submitting → success
                             → error → editing

Estados IMPOSSÍVEIS que uma máquina previne:
  submitting + editing ao mesmo tempo
  success + error ao mesmo tempo
```

**Estrutura de uma máquina simples:**
```
machine = {
  initial: 'idle',
  states: {
    idle:       { on: { START:  'editing'    } },
    editing:    { on: { SUBMIT: 'submitting' } },
    submitting: { on: { SUCCESS: 'success', FAILURE: 'error' } },
    success:    { on: { RESET:  'idle'       } },
    error:      { on: { RETRY:  'submitting', EDIT: 'editing' } }
  }
}
```

**Biblioteca**: `XState` (mais completa) ou implemente manualmente com
um objeto de configuração + reducer.

---

## Critérios para Escolher Ferramentas {#ferramentas}

Escolha a ferramenta mais simples que resolve o problema:

```
Estado local simples
  → primitivo do framework (useState, ref, signal)

Estado local complexo / transições
  → useReducer / useMachine (XState Lite)

Estado compartilhado entre poucos componentes
  → lifting state up

Estado compartilhado em muitos níveis
  → Context API / Provide-Inject

Estado de servidor (fetch, cache, revalidação)
  → TanStack Query / SWR

Estado global de aplicação complexo
  → Zustand / Pinia / Jotai / Nano Stores

Estado de URL
  → useSearchParams / router.query + sincronização manual
```

**Sinais de que você escolheu a ferramenta errada:**
- Você está passando store/context para tudo, inclusive estado que poderia ser local
- Você tem efeitos colaterais complexos para sincronizar "estado" com a URL
- Sua store global tem dezenas de slices para coisas não relacionadas
- Você está re-implementando cache de servidor numa store global
