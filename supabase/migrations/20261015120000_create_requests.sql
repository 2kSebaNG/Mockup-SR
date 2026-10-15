-- Requirement requests created from "Nueva solicitud" and listed in "Mis solicitudes".
-- Only server functions access this table (service role), so RLS is enabled with no public policies.
create sequence if not exists public.requests_code_seq start 1201;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('REQ-' || lpad(nextval('public.requests_code_seq')::text, 4, '0')),
  requester text not null,
  category text not null check (char_length(category) between 1 and 80),
  quantity numeric not null check (quantity > 0 and quantity <= 1000000),
  unit text not null default 'Unidades',
  description text not null default '' check (char_length(description) <= 4000),
  fields jsonb not null default '[]'::jsonb,
  due_date date not null,
  status text not null default 'Enviada' check (status in ('Enviada', 'En revisión', 'Autorizado', 'Rechazado', 'Anulado')),
  authorizer_name text not null,
  authorizer_role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requests_requester_due_idx on public.requests (requester, due_date);

alter table public.requests enable row level security;
