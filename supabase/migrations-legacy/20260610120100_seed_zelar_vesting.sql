-- ============================================================================
-- Seed: Indicadores de vesting da iniciativa Zelar
-- ============================================================================
-- Idempotente: só insere se a iniciativa Zelar existir E o indicador (por nome)
-- ainda não estiver cadastrado. Seguro para rodar mais de uma vez.
--
-- Migration de SEED separada do schema de propósito — não acopla a estrutura
-- a dados de uma iniciativa específica.
--
-- Os mesmos 5 indicadores também podem ser criados em 1 clique pela UI
-- (botão "Usar marcos da Zelar"), para qualquer iniciativa.
-- ============================================================================

-- Função auxiliar inline via INSERT ... SELECT para cada indicador.
-- Resolve o submission_id da Zelar por project_name (case-insensitive).

INSERT INTO public.vesting_indicators
  (submission_id, name, goal_description, weight, status, target_value, unit, direction, display_order)
SELECT s.id, x.name, x.goal_description, x.weight, 'pendente', x.target_value, x.unit, x.direction, x.display_order
FROM public.submissions s
CROSS JOIN (VALUES
  ('Serviços completados (com avaliação registrada)',
   '≥ 200 serviços realizados e avaliados', 4.00::numeric, 200::numeric, 'serviços', 'gte', 1),
  ('Número de clientes ativos',
   '≥ 150 clientes únicos com ao menos 1 serviço concluído', 4.00::numeric, 150::numeric, 'clientes', 'gte', 2),
  ('Profissionais qualificados ativos',
   '≥ 27 profissionais com perfil verificado com pelo menos 1 serviço concluído', 4.00::numeric, 27::numeric, 'profissionais', 'gte', 3),
  ('CAC real 3 primeiras vendas',
   'CAC real das 3 primeiras vendas documentadas', 4.00::numeric, NULL::numeric, 'R$', 'lte', 4),
  ('ROAS sobre receita bruta',
   '≥ 1,5x', 4.00::numeric, 1.5::numeric, 'x', 'gte', 5)
) AS x(name, goal_description, weight, target_value, unit, direction, display_order)
WHERE s.project_name ILIKE '%zelar%'
  AND NOT EXISTS (
    SELECT 1 FROM public.vesting_indicators vi
    WHERE vi.submission_id = s.id AND vi.name = x.name
  );

-- ============================================================================
-- ROLLBACK (manual) — remove apenas os indicadores semeados da Zelar
-- ============================================================================
-- DELETE FROM public.vesting_indicators vi
-- USING public.submissions s
-- WHERE vi.submission_id = s.id
--   AND s.project_name ILIKE '%zelar%'
--   AND vi.name IN (
--     'Serviços completados (com avaliação registrada)',
--     'Número de clientes ativos',
--     'Profissionais qualificados ativos',
--     'CAC real 3 primeiras vendas',
--     'ROAS sobre receita bruta'
--   );
