-- XMPVAS0HE — Colaborador pode ver todas as submissões (necessário para review)
--
-- Contexto:
--   A policy existente "Users can view their own submissions" (auth.uid() = user_id)
--   restricts founders corretamente às próprias submissões, mas bloqueia colaboradores
--   de acessar submissões alheias — o que quebra o fluxo de review em /iniciativa/:id.
--
-- Esta policy libera SELECT total para colaboradores (análogo à policy de admin).
-- A defesa para founders permanece dupla:
--   • RLS: "Users can view their own submissions" (auth.uid() = user_id)
--   • Frontend: .eq("user_id", user.id) em DashboardFounder.tsx
--
-- Resultado líquido por role:
--   founder     → só as próprias (RLS + filtro frontend)
--   colaborador → todas (necessário para kanban de review e /iniciativa/:id)
--   admin       → todas (policy preexistente "Admins can view all submissions")
--   viewer      → nenhuma (sem policy SELECT = bloqueado por default do RLS)

CREATE POLICY "colaborador_view_all_submissions"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::app_role));
