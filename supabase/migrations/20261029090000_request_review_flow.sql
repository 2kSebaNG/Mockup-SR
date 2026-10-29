-- The contract administrator now starts a review before deciding: Enviada → En revisión (administrator reviewing)
-- → En gestión (delegated to a department) → Completada / Rechazado. "Autorizado" is renamed "Completada", and
-- what used to be "En revisión" (always with a department) becomes "En gestión".
alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests drop constraint if exists requests_check;

update public.requests set status = 'En gestión' where status = 'En revisión' and department is not null;
update public.requests set status = 'Completada' where status = 'Autorizado';

alter table public.requests
  add constraint requests_status_check check (status in ('Enviada', 'En revisión', 'En gestión', 'Completada', 'Rechazado', 'Anulado')),
  add constraint requests_delegated_check check (status <> 'En gestión' or (department is not null and assignee_name is not null));

-- When each step happened, for the dashboards (resolution time, received vs classified, created vs completed).
alter table public.requests
  add column if not exists review_started_at timestamptz,
  add column if not exists delegated_at timestamptz,
  add column if not exists resolved_at timestamptz;

-- Existing rows only know their last update; it is the best estimate of when they reached their current status.
update public.requests set delegated_at = updated_at where department is not null and delegated_at is null;
update public.requests set review_started_at = coalesce(delegated_at, updated_at) where status <> 'Enviada' and status <> 'Anulado' and review_started_at is null;
update public.requests set resolved_at = updated_at where status in ('Completada', 'Rechazado', 'Anulado') and resolved_at is null;

create index if not exists requests_resolved_at_idx on public.requests (resolved_at) where resolved_at is not null;
