-- Master catalogs ("catálogos maestros") of element types per category, e.g. the "Cargo" of a Personas request.
-- The request form suggests elements while typing (debounced) with pg_trgm; an element typed that is not here is
-- kept as a pending proposal on the request and only inserted once the contract administrator approves it.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Lowercase without accents, immutable so it can back an index ("Grúa" and "grua" match the same way).
create or replace function public.search_normalize(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, ''))) $$;

-- Each category names its element input ("Cargo", "Tipo de máquina"…).
alter table public.requirement_categories add column if not exists element_label text not null default 'Tipo de elemento';

-- Suggested new categories and the select attributes they start with.
insert into public.requirement_categories (name, field_ids) values
  ('EPP', array['unidad', 'marca', 'dimensiones']),
  ('Servicios', array['unidad']),
  ('Vehículos', array['unidad', 'capacidad', 'alimentacion']),
  ('Combustibles y lubricantes', array['unidad', 'formato'])
on conflict (name) do nothing;

update public.requirement_categories as c set element_label = l.label
from (values
  ('Herramientas', 'Tipo de herramienta'),
  ('Maquinarias', 'Tipo de máquina'),
  ('Personas', 'Cargo'),
  ('Materiales', 'Tipo de material'),
  ('Alimentos', 'Producto'),
  ('EPP', 'Elemento de protección'),
  ('Servicios', 'Tipo de servicio'),
  ('Vehículos', 'Tipo de vehículo'),
  ('Combustibles y lubricantes', 'Producto')
) as l(name, label)
where c.name = l.name;

create table if not exists public.requirement_elements (
  id bigint generated always as identity primary key,
  category text not null references public.requirement_categories (name) on update cascade on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- Names corrected by the administrator, so requests using the old name map here.
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists requirement_elements_category_name_key on public.requirement_elements (category, public.search_normalize(name));
-- Trigram index used by the % / <% operators in the search below.
create index if not exists requirement_elements_name_trgm_idx on public.requirement_elements using gin (public.search_normalize(name) extensions.gin_trgm_ops);

alter table public.requirement_elements enable row level security;

-- Suggestions for what is being typed: trigram similarity, word similarity (partial words) and plain containment,
-- best first. Mirrors elementScore() in src/lib/elements.ts, which is what local development uses.
create or replace function public.search_requirement_elements(p_category text, p_query text, p_limit integer default 8)
returns table (name text, score real)
language sql
stable
set search_path = ''
as $$
  with q as (select public.search_normalize(p_query) as v)
  select ranked.name, ranked.score
  from (
    select e.name,
      greatest(
        extensions.similarity(public.search_normalize(e.name), q.v),
        extensions.word_similarity(q.v, public.search_normalize(e.name)),
        case when strpos(public.search_normalize(e.name), q.v) > 0 then 0.6 + 0.4 * char_length(q.v)::real / greatest(char_length(e.name), 1) else 0 end
      )::real as score
    from public.requirement_elements e, q
    where public.search_normalize(e.category) = public.search_normalize(p_category)
      and char_length(q.v) >= 2
      and (public.search_normalize(e.name) operator(extensions.%) q.v
        or q.v operator(extensions.<%) public.search_normalize(e.name)
        or strpos(public.search_normalize(e.name), q.v) > 0)
  ) as ranked
  where ranked.score >= 0.3
  order by ranked.score desc, ranked.name
  limit least(greatest(p_limit, 1), 20)
$$;

-- Initial master catalogs (same as defaultElements in src/lib/elements.ts).
insert into public.requirement_elements (category, name) values
  ('Herramientas', 'Taladro percutor'),
  ('Herramientas', 'Esmeril angular'),
  ('Herramientas', 'Llave de impacto'),
  ('Herramientas', 'Sierra circular'),
  ('Herramientas', 'Martillo demoledor'),
  ('Herramientas', 'Atornillador inalámbrico'),
  ('Herramientas', 'Nivel láser'),
  ('Herramientas', 'Rotomartillo'),
  ('Herramientas', 'Soldadora inverter'),
  ('Herramientas', 'Tecle de cadena'),
  ('Herramientas', 'Llave de torque'),
  ('Herramientas', 'Caja de herramientas'),
  ('Maquinarias', 'Grúa horquilla'),
  ('Maquinarias', 'Retroexcavadora'),
  ('Maquinarias', 'Excavadora'),
  ('Maquinarias', 'Camión pluma'),
  ('Maquinarias', 'Minicargador'),
  ('Maquinarias', 'Generador eléctrico'),
  ('Maquinarias', 'Compresor de aire'),
  ('Maquinarias', 'Rodillo compactador'),
  ('Maquinarias', 'Manipulador telescópico'),
  ('Maquinarias', 'Plataforma elevadora'),
  ('Maquinarias', 'Grúa móvil'),
  ('Maquinarias', 'Motoniveladora'),
  ('Personas', 'Soldador'),
  ('Personas', 'Electricista'),
  ('Personas', 'Operador de grúa'),
  ('Personas', 'Rigger'),
  ('Personas', 'Ayudante'),
  ('Personas', 'Capataz'),
  ('Personas', 'Prevencionista de riesgos'),
  ('Personas', 'Topógrafo'),
  ('Personas', 'Supervisor de terreno'),
  ('Personas', 'Mecánico'),
  ('Personas', 'Maestro albañil'),
  ('Personas', 'Operador de maquinaria'),
  ('Materiales', 'Perfil de acero'),
  ('Materiales', 'Plancha de acero'),
  ('Materiales', 'Cemento'),
  ('Materiales', 'Arena'),
  ('Materiales', 'Grava'),
  ('Materiales', 'Tubería HDPE'),
  ('Materiales', 'Cable eléctrico'),
  ('Materiales', 'Perno'),
  ('Materiales', 'Tornillo'),
  ('Materiales', 'Pintura epóxica'),
  ('Materiales', 'Madera pino'),
  ('Materiales', 'Malla acma'),
  ('Alimentos', 'Colación'),
  ('Alimentos', 'Agua purificada'),
  ('Alimentos', 'Café'),
  ('Alimentos', 'Fruta'),
  ('Alimentos', 'Pan'),
  ('Alimentos', 'Snack'),
  ('Alimentos', 'Jugo'),
  ('EPP', 'Casco de seguridad'),
  ('EPP', 'Guantes de cabritilla'),
  ('EPP', 'Lentes de seguridad'),
  ('EPP', 'Zapatos de seguridad'),
  ('EPP', 'Arnés de seguridad'),
  ('EPP', 'Protector auditivo'),
  ('EPP', 'Chaleco reflectante'),
  ('EPP', 'Respirador con filtro'),
  ('EPP', 'Careta de soldar'),
  ('EPP', 'Ropa ignífuga'),
  ('Servicios', 'Transporte de personal'),
  ('Servicios', 'Arriendo de baños químicos'),
  ('Servicios', 'Retiro de residuos'),
  ('Servicios', 'Calibración de equipos'),
  ('Servicios', 'Mantención de maquinaria'),
  ('Servicios', 'Servicio de alimentación'),
  ('Servicios', 'Aseo industrial'),
  ('Servicios', 'Arriendo de contenedor'),
  ('Vehículos', 'Camioneta 4x4'),
  ('Vehículos', 'Furgón'),
  ('Vehículos', 'Bus'),
  ('Vehículos', 'Minibús'),
  ('Vehículos', 'Camión aljibe'),
  ('Vehículos', 'Camión tolva'),
  ('Vehículos', 'Camión rampla'),
  ('Vehículos', 'Automóvil'),
  ('Combustibles y lubricantes', 'Diésel'),
  ('Combustibles y lubricantes', 'Gasolina 93'),
  ('Combustibles y lubricantes', 'Gasolina 95'),
  ('Combustibles y lubricantes', 'Aceite hidráulico'),
  ('Combustibles y lubricantes', 'Aceite de motor'),
  ('Combustibles y lubricantes', 'Grasa'),
  ('Combustibles y lubricantes', 'Refrigerante'),
  ('Combustibles y lubricantes', 'Líquido de frenos')
on conflict do nothing;

-- The element of each request and the label it was asked under.
alter table public.requests add column if not exists element text not null default '';
alter table public.requests add column if not exists element_label text not null default 'Tipo de elemento';
