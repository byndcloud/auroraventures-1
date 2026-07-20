# Snippet — Template de Componente

Template genérico adaptável para React, Vue, Svelte ou Web Components.
Substitua a sintaxe de template mantendo a estrutura de responsabilidades.

## Estrutura de arquivo

```
ComponentName/
├── ComponentName.{jsx|vue|svelte}   ← componente principal
├── ComponentName.test.{js|ts}       ← testes
├── ComponentName.module.css         ← estilos (se CSS Modules)
└── index.{js|ts}                    ← barrel export
```

## Template — React/JSX

```jsx
// ComponentName.jsx
// Responsabilidade: [descreva em uma linha o que este componente faz]

import { useState, useCallback } from 'react';
// import styles from './ComponentName.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ComponentNameProps
 * @property {string} [className] - Classe CSS adicional
 * @property {Function} [onAction] - Callback chamado quando [descreva]
 * // ... adicione outras props
 */

// ─── Constantes ──────────────────────────────────────────────────────────────

const DEFAULT_VALUE = '';

// ─── Componente ──────────────────────────────────────────────────────────────

/**
 * ComponentName — [descrição de uma linha]
 *
 * @param {ComponentNameProps} props
 */
export function ComponentName({
  className = '',
  onAction,
  // ...outras props com defaults explícitos
}) {
  // ── Estado local ──────────────────────────────────────────────────────────
  const [value, setValue] = useState(DEFAULT_VALUE);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAction = useCallback((event) => {
    // Lógica de handler aqui
    onAction?.(value);
  }, [value, onAction]);

  // ── Renderização ──────────────────────────────────────────────────────────
  return (
    <div className={`component-name ${className}`}>
      {/* Markup aqui */}
    </div>
  );
}

// Se o componente for usado amplamente, exporte como default também:
// export default ComponentName;
```

## Template — Vue 3 (Composition API)

```vue
<!-- ComponentName.vue -->
<script setup>
// Responsabilidade: [descreva em uma linha o que este componente faz]

import { ref, computed } from 'vue';

// ─── Props ────────────────────────────────────────────────────────────────

const props = defineProps({
  className: { type: String, default: '' },
  // ...adicione outras props
});

// ─── Emits ────────────────────────────────────────────────────────────────

const emit = defineEmits(['action']);

// ─── Estado ───────────────────────────────────────────────────────────────

const value = ref('');

// ─── Computed ─────────────────────────────────────────────────────────────

const derivedValue = computed(() => {
  return value.value;
});

// ─── Handlers ─────────────────────────────────────────────────────────────

function handleAction() {
  emit('action', value.value);
}
</script>

<template>
  <div :class="['component-name', props.className]">
    <!-- Markup aqui -->
  </div>
</template>
```

## Acessibilidade — checklist por tipo

**Componentes interativos (botão, toggle, link):**
```
- role correto ou elemento semântico nativo
- aria-label se o texto visível não for descritivo
- tabIndex="0" se não for elemento nativo
- handler de teclado (Enter e Space para botões)
```

**Componentes de formulário:**
```
- <label> associado via htmlFor/for
- aria-required para campos obrigatórios
- aria-invalid + aria-describedby para erros
- role="alert" na mensagem de erro
```

**Componentes de overlay (modal, dropdown, tooltip):**
```
- role="dialog" + aria-modal="true" para modais
- aria-label ou aria-labelledby
- Foco movido para o primeiro elemento ao abrir
- Foco retornado ao trigger ao fechar
- Escape fecha o overlay
```
