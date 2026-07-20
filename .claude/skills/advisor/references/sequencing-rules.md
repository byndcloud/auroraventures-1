# Sequencing Rules

Regras de ordenação de skills baseadas em dependências técnicas.
Use como referência no Passo 3 do Advisor.

---

## Regra 1 — Arquitetura sempre primeiro em mudanças estruturais

Quando há mudança de módulo, dependência entre camadas ou decisão de design de sistema,
`arquitetura` deve rodar antes de qualquer skill de implementação.

**Motivo:** Os outros skills dependem das interfaces e contratos definidos pela arquitetura.
Implementar antes de ter o design definido gera retrabalho garantido.

```
arquitetura → back → front → qa
arquitetura → back → qa
arquitetura → [skills afetados] → qa
```

---

## Regra 2 — Back antes de front quando há dependência de contrato

Quando o frontend precisa consumir uma API que o backend ainda vai criar ou modificar,
`back` deve rodar antes de `front`.

**Motivo:** O front depende do contrato de API (endpoints, payloads, erros) que só
existe após o back implementar. Implementar o front antes cria código especulativo
que frequentemente precisa ser refeito.

```
back → front → qa
arquitetura → back → front → qa → segurança
```

**Exceção:** Se o front e o back são totalmente independentes (ex: o front usa
uma API já existente sem modificação), podem ser tratados como tasks separadas.

---

## Regra 3 — Segurança antes do back em fixes de segurança

Quando a task é um fix de segurança e a vulnerabilidade define o que o back precisa mudar,
`segurança` deve rodar antes de `back`.

**Motivo:** O skill de segurança faz o diagnóstico e define o que precisa ser corrigido.
O back implementa a correção. Inverter a ordem faz o back "adivinhar" o fix.

```
segurança → back → qa
segurança → back → front → qa   (se a correção também impacta o front)
```

**Contraste com Regra 4:**

---

## Regra 4 — Segurança depois do back em validações de segurança

Quando a task não é um fix de segurança, mas a implementação toca áreas sensíveis
(auth, dados sensíveis, inputs externos), `segurança` valida o que o back produziu.

**Motivo:** Aqui a segurança é verificação, não definição. O back implementa
conforme as convenções do projeto, e a segurança confirma que nenhuma vulnerabilidade
foi introduzida.

```
back → segurança → qa
arquitetura → back → front → qa → segurança
```

---

## Regra 5 — QA sempre por último entre os skills de implementação

`qa` valida o conjunto completo das mudanças. Rodar antes dos outros skills
significa validar algo incompleto.

**Motivo:** Testes de integração e cobertura só fazem sentido após todas as
peças estarem no lugar.

```
[todos os outros skills] → qa
```

**Exceção:** Se a task é exclusivamente de QA (ex: adicionar testes para código existente),
`qa` pode ser o único skill sem nenhum anterior.

---

## Exemplos completos

### Feature fullstack com segurança

```
arquitetura → back → segurança → front → qa
```

Quando: nova feature que define contratos novos (arquitetura), implementa API (back),
toca dados sensíveis (segurança valida o back), cria tela (front), valida tudo (qa).

### Fix de segurança crítico

```
segurança → back → qa
```

Quando: vulnerabilidade identificada que exige refatoração de endpoint.
Segurança define o problema e o back corrige.

### Refactor de módulo compartilhado

```
arquitetura → back → front → qa
```

Quando: módulo usado por back e front precisa ser reestruturado.
Arquitetura define as novas interfaces, back e front adaptam, qa valida.

### Nova feature só de front com dados sensíveis

```
front → segurança → qa
```

Quando: nova tela que lida com dados pessoais do usuário.
Front implementa, segurança valida a exibição e armazenamento dos dados, qa valida.

### Migração complexa (auth + schema + UI)

```
arquitetura → segurança → back → front → qa
```

Quando: mudança de sistema de autenticação que impacta toda a stack.
Arquitetura define o novo modelo, segurança define as regras de token,
back implementa, front adapta, qa valida o fluxo completo.
