
create table public.submission_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade not null,
  from_status text,
  to_status text not null,
  moved_by uuid not null,
  moved_at timestamptz not null default now()
);

alter table public.submission_history enable row level security;

create policy "admin_can_read_history" on public.submission_history
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create policy "authenticated_can_insert_history" on public.submission_history
  for insert to authenticated
  with check (auth.uid() = moved_by);
