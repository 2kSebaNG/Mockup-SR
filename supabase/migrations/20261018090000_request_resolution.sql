-- Rejections always carry a reason, and pending requests can have an estimated resolution date.
alter table public.requests
  add column if not exists rejection_reason text,
  add column if not exists estimated_resolution date;

-- Tables list the newest requests first.
create index if not exists requests_created_at_idx on public.requests (created_at desc);
