import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Eye, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  Combobox, DataListSkeleton, MasterDetail, MoneyInput, PageTab, PageTabs, RutInput, SegmentedFilter, Stepper, rutProblem,
  Actions, Badge, Callout, ChoiceCard, ChoiceGrid, DataList, DescriptionList, EmptyState, FilterBar, FilterField, FormActions, FormRow,
  IconAction, Optional, Page, PageHeader, Pagination, Panel, SearchInput, Stack, Stat, StatRow, Tag, Tags, paginate, type DataColumn, type Tone,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createFileRoute("/sistema-diseno")({
  component: DesignSystemPage,
  head: () => ({ meta: [{ title: "Sistema de diseño | Ecosistema X" }, { name: "description", content: "Tokens y componentes con los que se construyen las vistas de Ecosistema X." }] }),
});

const sections = [
  ["principios", "Principios"], ["color", "Color"], ["tipografia", "Tipografía"], ["espacio", "Espacio y forma"],
  ["pagina", "Página"], ["estado", "Estado y mensajes"], ["listados", "Listados"], ["formularios", "Formularios"], ["flujos", "Flujos y selección"], ["datos", "Datos"],
] as const;

/** A token as a swatch: the color, its name and what it is for. */
function Swatch({ token, use, border = false }: { token: string; use: string; border?: boolean }) {
  return (
    <div className="dsg-swatch">
      <span className="dsg-swatch-color" style={{ background: `var(--${token})`, borderColor: border ? "var(--border)" : "transparent" }} />
      <code>--{token}</code>
      <span>{use}</span>
    </div>
  );
}

/** A live example and the code that makes it. */
function Example({ title, description, code, children }: { title: string; description?: ReactNode; code: string; children: ReactNode }) {
  return (
    <Panel title={title} description={description}>
      <div className="dsg-demo">{children}</div>
      <pre className="dsg-code"><code>{code.trim()}</code></pre>
    </Panel>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="dsg-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="dsg-section-title">{title}</h2>
      {intro && <p className="dsg-section-intro">{intro}</p>}
      <Stack>{children}</Stack>
    </section>
  );
}

const tones: { tone: Tone; label: string; use: string }[] = [
  { tone: "info", label: "Enviada", use: "info · recién creado, pendiente de otro" },
  { tone: "warning", label: "En revisión", use: "warning · esperando, por vencer" },
  { tone: "progress", label: "En gestión", use: "progress · alguien lo está trabajando" },
  { tone: "success", label: "Completada", use: "success · terminado bien, activo" },
  { tone: "danger", label: "Rechazado", use: "danger · rechazado, error" },
  { tone: "neutral", label: "Anulado", use: "neutral · fuera de juego, desactivado" },
];

type Sample = { id: string; name: string; email: string; area: string; requests: number; tone: Tone; status: string };
const samples: Sample[] = [
  { id: "1", name: "Ana María Pérez", email: "aperez@aecon.cl", area: "Operaciones", requests: 12, tone: "success", status: "Activo" },
  { id: "2", name: "Jorge Muñoz", email: "jmunoz@aecon.cl", area: "Finanzas", requests: 4, tone: "info", status: "Invitado" },
  { id: "3", name: "Camila Rojas", email: "crojas@aecon.cl", area: "Recursos Humanos", requests: 0, tone: "warning", status: "Invitación vencida" },
  { id: "4", name: "Diego Fuentes", email: "dfuentes@aecon.cl", area: "Bodega", requests: 7, tone: "neutral", status: "Desactivado" },
  { id: "5", name: "Valentina Soto", email: "vsoto@aecon.cl", area: "Operaciones", requests: 21, tone: "success", status: "Activo" },
  { id: "6", name: "Matías Herrera", email: "mherrera@aecon.cl", area: "Mantención", requests: 3, tone: "success", status: "Activo" },
];
const sampleColumns: DataColumn<Sample>[] = [
  { key: "name", header: "Persona", card: "title", cell: row => <span className="flex flex-col"><a href="#listados" className="ds-link">{row.name}</a><span className="ds-meta">{row.email}</span></span> },
  { key: "area", header: "Área", cell: row => row.area },
  { key: "status", header: "Estado", cell: row => <Badge tone={row.tone}>{row.status}</Badge> },
  { key: "requests", header: "Solicitudes", align: "end", cell: row => row.requests },
];

function DesignSystemPage() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [choices, setChoices] = useState<string[]>(["ver"]);
  const filtered = samples.filter(row => row.name.toLowerCase().includes(term.toLowerCase()));
  const { current, visible } = paginate(filtered, page, pageSize);
  const [tab, setTab] = useState("reporte");
  const [segment, setSegment] = useState<"pendientes" | "aprobadas" | "rechazadas" | "todas">("pendientes");
  const [picked, setPicked] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(1250000);
  const [rut, setRut] = useState("");
  const toggle = (key: string, on: boolean) => setChoices(list => (on ? [...list, key] : list.filter(value => value !== key)));

  return (
    <AppShell trail={["Sistema de diseño"]}>
      <TooltipProvider delayDuration={200}>
        <Page>
          <PageHeader
            eyebrow="Referencia"
            title="Sistema de diseño"
            description="Tokens y componentes con los que se construye cada vista de Ecosistema X. Úsalos tal cual en vistas nuevas y lleva a ellos las existentes cuando las toques."
            actions={<Button asChild variant="outline"><a href="https://github.com/2kSebaNG/Mockup-SR/blob/main/docs/design-system.md" target="_blank" rel="noreferrer">Guía completa</a></Button>}
          />

          <nav className="dsg-toc" aria-label="Secciones">
            {sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>

          <Section id="principios" title="Principios">
            <div className="dsg-principles">
              {[
                ["Grafito y rojo", "El grafito del sidebar y el rojo de marca son la identidad. El rojo es para la acción principal, el eyebrow y lo que pide atención; nunca para decorar."],
                ["Tarjetas planas", "Cada bloque va en una tarjeta blanca con borde de 1px y radio de 6px, sin sombra. La sombra queda para lo que flota: menús, modales, el botón de accesos."],
                ["Títulos condensados", "Barlow Condensed para títulos, encabezados de tabla y cifras; Source Sans 3 para leer. Los encabezados de tabla y los eyebrows van en mayúsculas."],
                ["Color con significado", "Seis tonos suaves cuentan el estado (info, warning, progress, success, danger, neutral). Un mismo tono significa lo mismo en badges, avisos, KPIs y gráficos."],
                ["Claro y oscuro", "Todo color sale de un token, así cada vista funciona en los dos temas sin código extra. En oscuro la página toma el grafito y las tarjetas suben en luminosidad."],
                ["Nada se esconde", "Ninguna página se desplaza hacia el lado. Las listas pasan a tarjetas cuando no caben y las acciones bloqueadas siguen visibles con el motivo en su tooltip."],
              ].map(([title, text]) => <Panel key={title} title={title}><p className="dsg-text">{text}</p></Panel>)}
            </div>
          </Section>

          <Section id="color" title="Color" intro="Siempre por token (var(--token) o la utilidad de Tailwind: bg-primary, text-muted-foreground…). Cambia el tema arriba a la derecha para ver ambos valores.">
            <Panel title="Marca y superficies">
              <div className="dsg-swatches">
                <Swatch token="primary" use="Acción principal, eyebrow, foco de marca" />
                <Swatch token="background" use="Fondo de la página" border />
                <Swatch token="card" use="Tarjetas, tablas, filtros" border />
                <Swatch token="secondary" use="Encabezado de tabla, tags" border />
                <Swatch token="foreground" use="Texto" />
                <Swatch token="muted-foreground" use="Texto secundario, etiquetas" />
                <Swatch token="border" use="Bordes y divisores" border />
                <Swatch token="surface" use="Bandas grafito (aviso note, portada)" />
                <Swatch token="sidebar" use="Sidebar (grafito en ambos temas)" />
                <Swatch token="link" use="Enlaces dentro del contenido" />
                <Swatch token="destructive" use="Eliminar, errores" />
                <Swatch token="due-soon" use="Plazo por vencer, datos de ejemplo" />
              </div>
            </Panel>
            <Panel title="Tonos de estado" description="Relleno suave (--status-*) con su texto (--status-*-text). En componentes se eligen por significado con tone.">
              <div className="dsg-swatches">
                {tones.map(({ tone, label, use }) => (
                  <div key={tone} className="dsg-swatch">
                    <Badge tone={tone}>{label}</Badge>
                    <code>tone="{tone}"</code>
                    <span>{use.split(" · ")[1]}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Series de gráficos" description="--series-1 … --series-8 en este orden, sin ciclar; con más categorías se agrupan en «Otras».">
              <div className="dsg-series">{Array.from({ length: 8 }, (_, index) => <span key={index} style={{ background: `var(--series-${index + 1})` }} title={`--series-${index + 1}`} />)}</div>
            </Panel>
          </Section>

          <Section id="tipografia" title="Tipografía">
            <Panel>
              <div className="dsg-type">
                {[
                  ["--display-lg · 48", "ds-title", "Título de página"],
                  ["--display-sm · 32", "ds-stat-value", "Cifra de KPI 1.284"],
                  ["--title-lg · 24", "ds-empty-title", "Título de estado vacío"],
                  ["--title-md · 20", "ds-panel-title", "Título de tarjeta"],
                  ["--text-sm · 13 · mayúsculas", "ds-eyebrow", "Eyebrow de sección"],
                  ["--text-lead · 17", "ds-description", "Descripción bajo el título de la página."],
                  ["--text-md · 14", "dsg-type-md", "Texto de tablas, formularios y tarjetas. Es el tamaño de lectura por defecto."],
                  ["--text-xs · 12", "ds-meta", "Texto secundario: correos, fechas, ayudas."],
                ].map(([token, className, sample]) => (
                  <div key={token} className="dsg-type-row">
                    <code>{token}</code>
                    <span className={className}>{sample}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </Section>

          <Section id="espacio" title="Espacio y forma" intro="Escala de 4px. Entre bloques de una página 20px (Stack), dentro de una tarjeta 12–16px, entre etiqueta y control 6px.">
            <Panel>
              <div className="dsg-spaces">
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(step => (
                  <div key={step}><code>--space-{step}</code><span style={{ width: `var(--space-${step})` }} /><span className="ds-meta">{step * 4}px</span></div>
                ))}
              </div>
              <div className="dsg-radii">
                {[["--radius-sm", "2px", "Barras"], ["--radius (lg)", "6px", "Tarjetas, botones, campos"], ["4px", "4px", "Tags, aviso note"], ["999px", "pill", "Badges"]].map(([token, value, use]) => (
                  <div key={token}><span style={{ borderRadius: value === "pill" ? 999 : value }} /><code>{token}</code><span className="ds-meta">{use}</span></div>
                ))}
              </div>
            </Panel>
          </Section>

          <Section id="pagina" title="Página" intro="Toda vista dentro de AppShell empieza igual: Page, PageHeader y bloques en Stack.">
            <Example
              title="Page y PageHeader"
              description="Eyebrow con la sección, título, una frase de descripción y las acciones. En teléfono las acciones pasan abajo, dos por fila."
              code={`
<AppShell trail={["Recursos Humanos", "Empleados"]}>
  <Page>
    <PageHeader
      back={<BackLink to="/empleados">Empleados</BackLink>}
      eyebrow="Personas y accesos"
      title="Empleados"
      description="Quién trabaja en la plataforma y qué puede hacer."
      actions={<Button><Plus />Invitar empleado</Button>}
    />
    <Stack>…</Stack>
  </Page>
</AppShell>`}
            >
              <div className="dsg-frame">
                <PageHeader eyebrow="Personas y accesos" title="Empleados" description="Quién trabaja en la plataforma y qué puede hacer." actions={<Button><Plus />Invitar empleado</Button>} />
              </div>
            </Example>
            <Example
              title="Panel"
              description="La tarjeta de cada bloque. Con flush no tiene relleno (tablas); Split pone una columna lateral de 320px."
              code={`
<Panel title="Datos personales" actions={<Button variant="outline" size="sm">Editar</Button>}>
  <DescriptionList items={[{ term: "RUT", detail: "12.345.678-5" }]} />
</Panel>`}
            >
              <Panel title="Datos personales" actions={<Button variant="outline" size="sm"><Pencil />Editar</Button>}>
                <DescriptionList items={[
                  { term: "Nombre", detail: "Ana María Pérez Soto" },
                  { term: "RUT", detail: "12.345.678-5" },
                  { term: "Teléfono", detail: "+56 9 1234 5678" },
                ]} />
              </Panel>
            </Example>
          </Section>

          <Section id="estado" title="Estado y mensajes">
            <Example
              title="Badge y Tag"
              description="Badge solo para estados, con su tono. Tag para etiquetas neutras como roles o categorías."
              code={`
<Badge tone="success">Activo</Badge>
<Tags>
  <Tag>Supervisor</Tag>
  <Tag>Administrador - Sistema</Tag>
</Tags>`}
            >
              <div className="dsg-row">{tones.map(({ tone, label }) => <Badge key={tone} tone={tone}>{label}</Badge>)}</div>
              <Tags><Tag>Supervisor</Tag><Tag>Recursos Humanos</Tag><Tag>Administrador - Sistema</Tag></Tags>
            </Example>
            <Example
              title="Callout"
              description="Mensajes dentro de la página. note es la banda grafito para lo que se debe leer primero; danger se anuncia como alerta."
              code={`
<Callout variant="note">Los cambios rigen desde la próxima acción.</Callout>
<Callout variant="warning" title="Invitación por vencer">Vence en 3 horas.</Callout>
<Callout variant="danger">No pudimos guardar los cambios.</Callout>
<Callout variant="sample">Este gráfico usa datos de ejemplo.</Callout>`}
            >
              <Stack>
                <Callout variant="note">Los cambios en un rol rigen desde la próxima acción de cada empleado que lo tenga.</Callout>
                <Callout variant="info">Te enviaremos una copia de la solicitud por correo.</Callout>
                <Callout variant="warning" title="Invitación por vencer">El enlace vence en 3 horas; puedes reenviarlo desde el menú «…».</Callout>
                <Callout variant="success">Invitación enviada a aperez@aecon.cl.</Callout>
                <Callout variant="danger">No pudimos guardar los cambios. Revisa tu conexión e inténtalo de nuevo.</Callout>
                <Callout variant="sample">Este gráfico usa datos de ejemplo hasta que las solicitudes tengan etapas.</Callout>
              </Stack>
            </Example>
            <Example
              title="EmptyState"
              description="Qué pasó y qué hacer ahora, con una sola acción. inline para dentro de una tarjeta o lista."
              code={`
<EmptyState icon={<Inbox />} title="Aún no hay solicitudes"
  action={<Button><Plus />Nueva solicitud</Button>}>
  Cuando envíes una, la verás aquí con su estado.
</EmptyState>`}
            >
              <EmptyState icon={<Inbox aria-hidden="true" />} title="Aún no hay solicitudes" action={<Button><Plus />Nueva solicitud</Button>}>Cuando envíes una, la verás aquí con su estado.</EmptyState>
            </Example>
          </Section>

          <Section id="listados" title="Listados" intro="Una lista es FilterBar + DataList + Pagination. DataList arma la tabla y las tarjetas desde las mismas columnas; achica la ventana para ver el cambio.">
            <Example
              title="FilterBar, DataList, IconAction y Pagination"
              code={`
const columns: DataColumn<Person>[] = [
  { key: "name", header: "Persona", card: "title", cell: p => <Link className="ds-link">{p.name}</Link> },
  { key: "status", header: "Estado", cell: p => <Badge tone={tone[p.status]}>{p.status}</Badge> },
  { key: "requests", header: "Solicitudes", align: "end", cell: p => p.requests },
];
const { current, visible } = paginate(rows, page, pageSize);

<FilterBar end={<Button variant="outline"><Download />Exportar</Button>}>
  <FilterField id="search" label="Buscar" grow><SearchInput id="search" … /></FilterField>
</FilterBar>
<DataList label="Personas" collapseAt="md" rows={visible} columns={columns} rowKey={p => p.id}
  actions={p => (
    <Actions>
      <IconAction label="Ver" asChild><Link to="…"><Eye /></Link></IconAction>
      <IconAction label="Eliminar" danger disabled reason="Es el último administrador"><Trash2 /></IconAction>
    </Actions>
  )}
  footer={<Pagination page={current} pageSize={pageSize} totalCount={rows.length} … />} />`}
            >
              <FilterBar label="Filtros de ejemplo" end={<Button variant="outline"><Download />Exportar</Button>}>
                <FilterField id="dsg-search" label="Buscar" grow>
                  <SearchInput id="dsg-search" placeholder="Nombre" value={term} onChange={event => { setTerm(event.target.value); setPage(1); }} />
                </FilterField>
                <FilterField id="dsg-area" label="Área">
                  <Select defaultValue="todas"><SelectTrigger id="dsg-area"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="ops">Operaciones</SelectItem></SelectContent></Select>
                </FilterField>
              </FilterBar>
              <DataList
                label="Personas de ejemplo"
                collapseAt="sm"
                rows={visible}
                columns={sampleColumns}
                rowKey={row => row.id}
                empty="Nadie coincide con la búsqueda."
                actions={row => (
                  <Actions>
                    <IconAction label={`Ver ${row.name}`}><Eye /></IconAction>
                    <IconAction label={`Editar ${row.name}`}><Pencil /></IconAction>
                    <IconAction label={`Eliminar ${row.name}`} danger disabled={row.id === "1"} reason="Es el último administrador: no se puede eliminar.">
                      <Trash2 />
                    </IconAction>
                  </Actions>
                )}
                footer={<Pagination page={current} pageSize={pageSize} sizes={[5, 10]} totalCount={filtered.length} onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }} />}
              />
            </Example>
          </Section>

          <Section id="formularios" title="Formularios" intro="Campos con el Field de shadcn (etiqueta, descripción y error), agrupados en FormRow y cerrados por FormActions: secundaria a la izquierda, principal al final. En modales anchos, FormActions sticky.">
            <Example
              title="FormRow, ChoiceCard y FormActions"
              code={`
<FormRow>
  <Field><FieldLabel htmlFor="name">Nombre</FieldLabel><Input id="name" /></Field>
  <Field><FieldLabel htmlFor="last">Apellidos</FieldLabel><Input id="last" /></Field>
</FormRow>
<ChoiceGrid min={220}>
  <ChoiceCard id="p-ver" title="Ver empleados" description="…" checked onCheckedChange={…} />
  <ChoiceCard id="p-del" title="Eliminar" description="No tienes este permiso" checked={false} locked />
</ChoiceGrid>
<FormActions>
  <Button variant="outline">Cancelar</Button>
  <Button type="submit">Guardar</Button>
</FormActions>`}
            >
              <form className="flex flex-col gap-5" onSubmit={event => event.preventDefault()}>
                <FormRow>
                  <Field><FieldLabel htmlFor="dsg-name">Nombre</FieldLabel><Input id="dsg-name" placeholder="Ana María" /></Field>
                  <Field><FieldLabel htmlFor="dsg-last">Apellidos</FieldLabel><Input id="dsg-last" placeholder="Pérez Soto" /></Field>
                </FormRow>
                <Field>
                  <FieldLabel htmlFor="dsg-note">Comentario <Optional /></FieldLabel>
                  <Input id="dsg-note" />
                  <FieldDescription>Lo verá quien revise la solicitud.</FieldDescription>
                </Field>
                <ChoiceGrid min={220}>
                  <ChoiceCard id="dsg-ver" title="Ver empleados" description="Consultar el listado y el detalle." checked={choices.includes("ver")} onCheckedChange={on => toggle("ver", on)} />
                  <ChoiceCard id="dsg-inv" title="Invitar empleados" description="Dar de alta y gestionar invitaciones." checked={choices.includes("inv")} onCheckedChange={on => toggle("inv", on)} />
                  <ChoiceCard id="dsg-del" title="Eliminar empleados" description="No tienes este permiso." checked={false} locked />
                </ChoiceGrid>
                <FormActions>
                  <Button type="button" variant="outline">Cancelar</Button>
                  <Button type="submit">Guardar cambios</Button>
                </FormActions>
              </form>
            </Example>
            <Panel title="Botones" description="Uno solo principal (rojo) por vista o modal. destructive solo para lo que no se deshace.">
              <div className="dsg-row">
                <Button>Principal</Button>
                <Button variant="outline">Secundario</Button>
                <Button variant="ghost">Terciario</Button>
                <Button variant="destructive"><Trash2 />Eliminar</Button>
                <Button variant="charcoal">Sobre grafito</Button>
                <Button disabled>Deshabilitado</Button>
              </div>
            </Panel>
          </Section>

          <Section id="flujos" title="Flujos y selección" intro="Piezas para módulos con registros que avanzan por etapas, colas de decisión y catálogos largos (Abastecimiento las usa). Una página a todo el ancho, para grillas por mes, es Page full.">
            <Example
              title="PageTabs"
              description="Pestañas entre las páginas de un mismo registro. Cada una es un enlace, así la URL dice cuál está abierta."
              code={`
<PageTabs label="Secciones del proyecto">
  <PageTab asChild active><Link to="/abastecimiento/reporte/$projectId" params={{ projectId }}>Reporte</Link></PageTab>
  <PageTab asChild><Link to="…/presupuesto" params={{ projectId }}>Presupuesto</Link></PageTab>
</PageTabs>`}
            >
              <PageTabs label="Secciones del proyecto de ejemplo">
                {[["reporte", "Reporte"], ["presupuesto", "Presupuesto"], ["plan", "Plan de abastecimiento"]].map(([key, label]) => (
                  <PageTab key={key} href={`#${key}`} active={tab === key} onClick={event => { event.preventDefault(); setTab(key!); }}>{label}</PageTab>
                ))}
              </PageTabs>
            </Example>
            <Example
              title="SegmentedFilter y Stepper"
              description="El filtro de estado sobre una lista, con el conteo de cada uno; y en qué etapa va un registro. Una etapa failed marca dónde se detuvo."
              code={`
<SegmentedFilter label="Estado" value={status} onChange={setStatus}
  options={[{ value: "pendientes", label: "Pendientes", count: 4 }, …]} />
<Stepper label="Avance de la orden" steps={["Borrador", "Enviada", "Aprobada", "Pagada"]} current={1} />
<Stepper label="Avance de la orden" steps={…} current={2} failed />`}
            >
              <SegmentedFilter label="Estado de las órdenes" value={segment} onChange={setSegment} options={[
                { value: "pendientes", label: "Pendientes", count: 4 }, { value: "aprobadas", label: "Aprobadas", count: 12 },
                { value: "rechazadas", label: "Rechazadas", count: 1 }, { value: "todas", label: "Todas", count: 17 },
              ]} />
              <Stepper label="Avance de una orden enviada" steps={["Borrador", "Enviada", "Aprobada", "Pagada"]} current={1} />
              <Stepper label="Avance de una orden rechazada" steps={["Borrador", "Enviada", "Rechazada"]} current={2} failed />
            </Example>
            <Example
              title="MasterDetail"
              description="Una cola y el detalle de lo elegido, lado a lado. Cuando no cabe muestra uno a la vez, con un botón para volver a la lista."
              code={`
<MasterDetail label="Órdenes por aprobar" open={selected !== null} onBack={() => setSelected(null)}
  list={<Panel flush>…</Panel>}
  detail={selected && <Panel title={selected.code}>…</Panel>} />`}
            >
              <MasterDetail
                label="Órdenes de ejemplo por aprobar"
                open={picked !== null}
                onBack={() => setPicked(null)}
                list={
                  <Panel flush>
                    <ul className="dsg-queue">
                      {[["OC-0412", "Ferretería Central", "$ 1.250.000"], ["OC-0415", "Arriendos del Norte", "$ 3.480.000"], ["OC-0419", "Comercial Austral", "$ 690.000"]].map(([code, vendor, total]) => (
                        <li key={code}><button type="button" aria-pressed={picked === code} onClick={() => setPicked(code!)}><strong>{code}</strong><span className="ds-meta">{vendor}</span><span>{total}</span></button></li>
                      ))}
                    </ul>
                  </Panel>
                }
                detail={picked
                  ? <Panel title={picked} actions={<Badge tone="warning">Enviada</Badge>}><DescriptionList items={[{ term: "Proyecto", detail: "MLA260301 · Mantención molinos SAG" }, { term: "Cuenta", detail: "5.2 Materiales" }]} /></Panel>
                  : <EmptyState inline title="Elige una orden">Su detalle aparece aquí.</EmptyState>}
              />
            </Example>
            <Example
              title="Combobox, MoneyInput y RutInput"
              description="Elegir entre muchos con búsqueda (también por código o RUT), montos en pesos y RUT con dígito verificador."
              code={`
<Combobox id="project" options={projects.map(p => ({ value: p.id, label: p.name, hint: p.code }))}
  value={projectId} onChange={setProjectId} placeholder="Elegir proyecto" searchPlaceholder="Nombre o código" />
<MoneyInput id="amount" value={amount} onValueChange={setAmount} />
<RutInput id="rut" value={rut} onValueChange={setRut} />
<FieldError>{rutProblem(rut)}</FieldError>`}
            >
              <FormRow columns={3}>
                <Field>
                  <FieldLabel htmlFor="dsg-project">Proyecto</FieldLabel>
                  <Combobox id="dsg-project" value={project} onChange={setProject} placeholder="Elegir proyecto" searchPlaceholder="Nombre o código" options={[
                    { value: "prj-1", label: "Mantención molinos SAG", hint: "MLA260301" }, { value: "prj-3", label: "Fundaciones y estructura", hint: "CPA260501" },
                    { value: "prj-5", label: "Colector principal", hint: "SDS251001" },
                  ]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dsg-amount">Monto neto</FieldLabel>
                  <MoneyInput id="dsg-amount" value={amount} onValueChange={setAmount} />
                </Field>
                <Field data-invalid={Boolean(rutProblem(rut))}>
                  <FieldLabel htmlFor="dsg-rut">RUT del proveedor</FieldLabel>
                  <RutInput id="dsg-rut" value={rut} onValueChange={setRut} />
                  <FieldError>{rutProblem(rut)}</FieldError>
                </Field>
              </FormRow>
            </Example>
            <Example title="DataListSkeleton" description="Una lista mientras carga, con la forma de DataList." code={`{isLoading ? <DataListSkeleton label="Proveedores" columns={5} /> : <DataList … />}`}>
              <DataListSkeleton label="Lista de ejemplo" columns={4} rows={3} />
            </Example>
          </Section>

          <Section id="datos" title="Datos" intro="Para cifras sueltas, Stat; para dashboards con gráficos, KpiRow, DashboardCard y los gráficos de components/dashboard/dashboard-ui.tsx, que siguen estos mismos tonos.">
            <Example
              title="Stat y StatRow"
              code={`
<StatRow>
  <Stat label="Enviadas" value={42} hint="Esperan revisión" tone="info" />
  <Stat label="Completadas" value={128} hint="Este mes" tone="success" />
</StatRow>`}
            >
              <StatRow>
                <Stat label="Enviadas" value={42} hint="Esperan revisión" tone="info" />
                <Stat label="En gestión" value={17} hint="En los departamentos" tone="progress" />
                <Stat label="Completadas" value={128} hint="Este mes" tone="success" />
                <Stat label="Rechazadas" value={6} hint="Con motivo" tone="danger" />
              </StatRow>
            </Example>
          </Section>
        </Page>
      </TooltipProvider>
    </AppShell>
  );
}
