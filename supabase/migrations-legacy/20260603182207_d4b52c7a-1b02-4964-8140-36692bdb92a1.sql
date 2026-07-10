UPDATE public.workspace_tasks
SET tem_decisao_aberta = CASE
  WHEN external_id IN ('N21.1','N21.2','N21.3','N7.7','N7.2','N4.2','N2.2','N19.1','N13.1','N15.1','N12.2','T1.4','N9.3') THEN true
  ELSE false
END
WHERE deleted_at IS NULL;