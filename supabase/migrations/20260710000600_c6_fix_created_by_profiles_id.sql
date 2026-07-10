-- ============================================================================
-- C6 — Corrige created_by gravado com profiles.id em calls
-- ============================================================================
-- O ChamadaForm antigo gravava calls.created_by = profiles.id (uuid da linha
-- de profiles), não o auth uid. Converte os registros legados para o auth uid
-- correspondente. O front novo já grava user.id.

UPDATE public.calls c
SET created_by = p.user_id
FROM public.profiles p
WHERE c.created_by = p.id
  AND c.created_by <> p.user_id;
