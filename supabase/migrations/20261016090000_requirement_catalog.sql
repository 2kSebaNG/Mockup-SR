-- Approved catalog of request types and their select attributes. New types, attributes or options that a requester
-- invents stay as a pending proposal on the request (requests.catalog_proposal) until the contract administrator
-- approves them; only then are they written here. Server functions are the only writers (service role).
create table if not exists public.requirement_fields (
  id text primary key,
  label text not null unique check (char_length(label) between 1 and 80),
  options text[] not null default '{}',
  -- Names corrected by the administrator, so requests using the old name map here.
  aliases text[] not null default '{}',
  option_aliases jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.requirement_categories (
  name text primary key check (char_length(name) between 1 and 80),
  field_ids text[] not null default '{}',
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.requirement_fields enable row level security;
alter table public.requirement_categories enable row level security;

-- Built-in catalog (same as src/lib/catalog.ts defaultCatalog).
insert into public.requirement_fields (id, label, options) values
  ('unidad', 'Unidad', array['Unidades', 'Litros', 'Kilogramos', 'Metros', 'Horas', 'Días']),
  ('marca', 'Marca', array['Sin preferencia', 'Bosch', 'Makita', 'DeWalt', 'Caterpillar']),
  ('dimensiones', 'Dimensiones', array['Pequeño', 'Mediano', 'Grande']),
  ('material', 'Material', array['Acero', 'Madera', 'Plástico', 'Aluminio']),
  ('especialidad', 'Especialidad', array['Operador', 'Electricista', 'Soldador', 'Ayudante']),
  ('capacidad', 'Capacidad', array['5 toneladas', '10 toneladas', '20 toneladas']),
  ('alimentacion', 'Alimentación', array['Eléctrica', 'Batería', 'Diésel', 'Manual']),
  ('formato', 'Formato', array['Individual', 'Caja', 'Bolsa', 'Botella'])
on conflict (id) do nothing;

insert into public.requirement_categories (name, field_ids) values
  ('Herramientas', array['unidad', 'marca', 'dimensiones', 'alimentacion']),
  ('Maquinarias', array['unidad', 'marca', 'capacidad', 'alimentacion']),
  ('Personas', array['unidad', 'especialidad']),
  ('Materiales', array['unidad', 'material', 'dimensiones']),
  ('Alimentos', array['unidad', 'formato'])
on conflict (name) do nothing;

-- Pending proposal of each request: { category, fields: [{ label, value, options }], decisions: { [itemKey]: { status, as?, options? } } }.
alter table public.requests add column if not exists catalog_proposal jsonb;
