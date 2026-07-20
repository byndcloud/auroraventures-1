# Migrations legadas (histórico do projeto original)

Estas 59 migrations documentam a evolução do banco no projeto original
(Lovable). **NÃO devem ser executadas no projeto novo.**

O schema atual do projeto é construído do zero pelas 8 migrations
consolidadas em `supabase/migrations/` — cada uma agrega o **efeito
líquido** de várias legacy do mesmo domínio, embutindo as correções C1–C8
e descartando data-fixes pontuais, versões inseguras substituídas e
duplicatas idempotentes.

Se quiser rastrear a origem de uma tabela/policy específica, cada arquivo
consolidado tem no cabeçalho um bloco `Consolida:` listando as legacy
absorvidas, e um bloco `Descartes:` com o que foi propositalmente removido.

Mantidas aqui apenas como referência histórica e para auditoria forense.
