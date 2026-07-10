
-- 1. Criar tabela de reuniões
create table public.meetings (
  id            uuid        primary key default gen_random_uuid(),
  submission_id uuid        not null references public.submissions(id) on delete cascade,
  title         text        not null,
  meeting_date  timestamptz not null,
  pre_agenda    text,
  transcript    text,
  smart_minutes text,
  created_by    uuid        references auth.users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2. Índice para performance
create index meetings_submission_id_idx on public.meetings(submission_id);

-- 3. Habilitar RLS
alter table public.meetings enable row level security;

-- 4. Policy: Admin pode fazer tudo (usando has_role, padrão do projeto)
create policy "admin_can_manage_meetings"
  on public.meetings
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 5. Trigger para atualizar updated_at automaticamente
create trigger meetings_updated_at
  before update on public.meetings
  for each row execute function public.update_updated_at_column();
