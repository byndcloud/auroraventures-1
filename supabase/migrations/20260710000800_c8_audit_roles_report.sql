-- ============================================================================
-- C8 — Auditoria de roles herdados da era "role via metadata do cliente"
-- ============================================================================
-- A primeira versão do handle_new_user confiava em raw_user_meta_data->>'role'
-- enviado pelo CLIENTE (auto-elevação possível). Contas criadas naquela época
-- podem ter role indevido. Esta migration NÃO altera dados: cria uma VIEW de
-- auditoria para revisão humana. Corrija divergências via UPDATE em user_roles
-- (o trigger sync_user_role_to_profile propaga para profiles.role).
--
--   SELECT * FROM public.role_audit_divergences;

CREATE OR REPLACE VIEW public.role_audit_divergences AS
SELECT
  u.id            AS user_id,
  u.email,
  ur.role         AS role_atual,
  CASE
    WHEN LOWER(u.email) IN (
      'rodrigo.miranda@beyondcompany.com.br',
      'filipe.moreira@beyondcompany.com.br'
    ) THEN 'admin'::public.app_role
    WHEN LOWER(u.email) LIKE '%@beyondcompany.com.br'
      OR LOWER(u.email) LIKE '%@extreme.digital'
      OR LOWER(u.email) LIKE '%@volund.com.br'
    THEN 'colaborador'::public.app_role
    ELSE 'founder'::public.app_role
  END             AS role_esperado_pela_regra,
  u.created_at
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role IS DISTINCT FROM (
  CASE
    WHEN LOWER(u.email) IN (
      'rodrigo.miranda@beyondcompany.com.br',
      'filipe.moreira@beyondcompany.com.br'
    ) THEN 'admin'::public.app_role
    WHEN LOWER(u.email) LIKE '%@beyondcompany.com.br'
      OR LOWER(u.email) LIKE '%@extreme.digital'
      OR LOWER(u.email) LIKE '%@volund.com.br'
    THEN 'colaborador'::public.app_role
    ELSE 'founder'::public.app_role
  END
)
-- 'viewer' é atribuição manual legítima — não é divergência
AND ur.role <> 'viewer';

-- View administrativa: apenas service_role/dashboard enxergam
REVOKE ALL ON public.role_audit_divergences FROM anon, authenticated;
