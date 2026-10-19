-- Several items sent together form a package: each is its own request (REQ-1501-1, REQ-1501-2…) pointing to
-- the parent code (REQ-1501), which takes a number from the same sequence as single requests.
alter table public.requests add column if not exists parent_code text;
create index if not exists requests_parent_code_idx on public.requests (parent_code) where parent_code is not null;

create or replace function public.next_request_code()
returns text
language sql
volatile
set search_path = public
as $$
  select 'REQ-' || lpad(nextval('public.requests_code_seq')::text, 4, '0');
$$;

-- Only server functions (service role) create requests.
revoke all on function public.next_request_code() from public, anon, authenticated;
