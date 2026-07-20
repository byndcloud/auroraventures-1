# Routing Examples

Exemplos de decisão de roteamento por tipo de task.
Use como referência ao aplicar as regras do Passo 2.

---

## Caminho A — Execução direta

### Exemplo 1 — Fix visual pontual

**Task:** "Ajustar cor do botão de submit para usar o token `color-primary-600`"

```
tipo: fix
domínio_primário: front
domínios_secundários: nenhum
impacto: baixo
dependência_técnica: não
```

**Rota:** EXECUÇÃO DIRETA
**Skill:** front
**Motivo:** Mudança de estilo isolada, sem API, sem impacto em outros domínios.

---

### Exemplo 2 — Novo endpoint isolado

**Task:** "Criar endpoint GET /products/search com filtro por nome"

```
tipo: feature
domínio_primário: back
domínios_secundários: nenhum
impacto: médio
dependência_técnica: não
```

**Rota:** EXECUÇÃO DIRETA
**Skill:** back
**Motivo:** Endpoint novo sem impacto em frontend existente. Front não depende desta task.

---

### Exemplo 3 — Fix de bug em módulo único

**Task:** "Corrigir SQL injection no endpoint de busca de produtos"

```
tipo: fix
domínio_primário: back
domínios_secundários: nenhum
impacto: médio
dependência_técnica: não
```

**Rota:** EXECUÇÃO DIRETA
**Skill:** back
**Motivo:** Fix cirúrgico em arquivo específico. Não altera contrato de API nem impacta front.

---

### Exemplo 4 — Atualização de teste

**Task:** "Adicionar testes para o hook useCheckout"

```
tipo: chore
domínio_primário: qa
domínios_secundários: nenhum
impacto: baixo
dependência_técnica: não
```

**Rota:** EXECUÇÃO DIRETA
**Skill:** qa
**Motivo:** Escopo de teste puro, sem mudança de implementação.

---

## Caminho B — Via Advisor

### Exemplo 5 — Feature fullstack

**Task:** "Criar funcionalidade de validação de endereço no checkout"

```
tipo: feature
domínio_primário: back
domínios_secundários: front, qa
impacto: médio
dependência_técnica: sim
  └─► front precisa consumir o endpoint POST /addresses/validate que o back vai criar
```

**Rota:** VIA ADVISOR
**Motivo:** Front não pode ser implementado antes do contrato de API do back estar definido.
O Advisor precisa sequenciar: back → front → qa.

---

### Exemplo 6 — Fix de segurança com impacto cross-stack

**Task:** "Migrar autenticação de sessão para JWT com refresh token"

```
tipo: refactor
domínio_primário: back
domínios_secundários: segurança, front, arquitetura
impacto: alto
dependência_técnica: sim
  └─► segurança define o modelo de token; back implementa; front armazena e renova
```

**Rota:** VIA ADVISOR
**Motivo:** Impacto alto com dependências em cascata entre 4 domínios.
Ordem incorreta pode gerar inconsistência de auth em produção.

---

### Exemplo 7 — Refactor estrutural

**Task:** "Separar módulo de pagamento em serviço independente"

```
tipo: refactor
domínio_primário: arquitetura
domínios_secundários: back, qa
impacto: alto
dependência_técnica: sim
  └─► back precisa do novo contrato de interface definido pela arquitetura
```

**Rota:** VIA ADVISOR
**Motivo:** Mudança estrutural que define contratos usados por outros skills.
Arquitetura deve rodar primeiro para os demais saberem o que implementar.

---

### Exemplo 8 — Feature com segurança crítica

**Task:** "Implementar upload de arquivos com validação de tipo e tamanho"

```
tipo: feature
domínio_primário: back
domínios_secundários: segurança, front
impacto: alto
dependência_técnica: sim
  └─► segurança define regras de validação; back implementa; front exibe feedback
```

**Rota:** VIA ADVISOR
**Motivo:** Inputs externos + impacto alto. Segurança deve definir as regras
antes do back implementar para não criar vulnerabilidades por design.

---

## Casos de borda

### "Só preciso ajustar uma string de texto na tela"
→ Caminho A, skill front. Impacto baixo, sem dependência.

### "Preciso adicionar um campo novo no formulário que salva no banco"
→ Caminho B. Front + back com dependência (campo precisa de endpoint novo ou atualizado).

### "Preciso corrigir um typo no nome de uma variável interna"
→ Caminho A, skill back ou front conforme o arquivo. Impacto baixo, sem dependência.

### "Preciso mudar o nome de um endpoint que o front já consome"
→ Caminho B. Mudança de contrato de API afeta front e back simultaneamente —
o Advisor precisa garantir que ambos sejam atualizados na ordem correta.
