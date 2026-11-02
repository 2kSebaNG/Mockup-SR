# Sistema de diseño de Ecosistema X

El sistema de diseño reúne la estética que ya tienen las vistas (grafito y rojo, tarjetas planas y títulos condensados) en tokens y componentes reutilizables. Con ellos:

- las vistas nuevas se arman sin reinventar estilos;
- las vistas antiguas se pueden llevar al mismo lenguaje cuando se tocan.

| Qué | Dónde |
| --- | --- |
| Tokens: color, tonos, tipografía, espacio, radios, sombras | `src/styles.css`, bloques `:root` y `.dark` |
| Estilos de los componentes (clases `ds-*`) | `src/components/ds/ds.css` |
| Componentes React | `src/components/ds/*.tsx`, importados desde `@/components/ds` |
| Primitivas (botón, input, select, diálogo, tooltip…) | `src/components/ui/*`, de shadcn/ui |
| Referencia viva, con ejemplos y código | Página `/sistema-diseno` (en el sidebar, «Sistema de diseño») |

## Principios

1. **Grafito y rojo.** El grafito del sidebar y el rojo de marca (`--primary`) son la identidad. El rojo se usa para la acción principal, el eyebrow y lo que pide atención. Nunca decora.
2. **Tarjetas planas.** Cada bloque va en una tarjeta blanca (`--card`) con borde de 1px y radio de 6px, sin sombra. La sombra queda para lo que flota: menús, modales y el botón de accesos rápidos.
3. **Títulos condensados.** Los títulos, encabezados de tabla y cifras usan Barlow Condensed (`--font-display`); el texto de lectura usa Source Sans 3 (`--font-sans`). Los eyebrows y los encabezados de tabla van en mayúsculas.
4. **Color con significado.** Seis tonos suaves cuentan el estado. Un mismo tono significa lo mismo en badges, avisos, KPIs y gráficos.
5. **Claro y oscuro gratis.** Todo color sale de un token, así que cada vista funciona en los dos temas. En oscuro la página toma el grafito y las tarjetas suben en luminosidad.
6. **Nada se esconde.** La página nunca se desplaza hacia el lado. Las listas pasan a tarjetas cuando no caben. Las acciones bloqueadas siguen visibles, con el motivo en su tooltip.

## Tokens

### Color

Usa siempre el token, ya sea con `var(--token)` en CSS o con la utilidad de Tailwind (`bg-primary`, `text-muted-foreground`, `border-border`). Nunca escribas un color literal en una vista. Si falta uno, agrégalo en `:root` y en `.dark`, en formato oklch, y regístralo en `@theme inline` si necesita una utilidad.

| Token | Uso |
| --- | --- |
| `--primary` | Acción principal, eyebrow, foco de marca |
| `--background` | Fondo de la página |
| `--card` | Tarjetas, tablas, barra de filtros |
| `--secondary` | Encabezado de tabla, tags |
| `--foreground` / `--muted-foreground` | Texto / texto secundario y etiquetas |
| `--border` | Bordes y divisores |
| `--surface*` | Bandas grafito (aviso `note`, portada) |
| `--sidebar*` | Sidebar: grafito en ambos temas |
| `--header*` | Barra superior: fondo de la página en claro, grafito en oscuro |
| `--link` | Enlaces dentro del contenido |
| `--destructive` | Eliminar, errores |
| `--due-soon` | Plazo por vencer, datos de ejemplo |
| `--series-1` … `--series-8` | Categorías en gráficos, en ese orden y sin ciclar |

### Tonos

Los componentes reciben un tono por su significado (`tone="success"`), no por su color. Cada tono usa un relleno suave `--status-*` y el texto que se lee sobre él, `--status-*-text`.

| Tono | Significa | Estados actuales |
| --- | --- | --- |
| `info` | Recién creado, pendiente de otro | Enviada, Invitado |
| `warning` | Esperando, por vencer | En revisión, Invitación vencida |
| `progress` | Alguien lo está trabajando | En gestión |
| `success` | Terminado bien, activo | Completada, Activo |
| `danger` | Rechazado, error | Rechazado |
| `neutral` | Fuera de juego | Anulado, Desactivado |

Un estado nuevo se asigna a uno de estos seis, por ejemplo en `requestStatusTone` (`ds/tone.ts`) o en el mapa de su módulo. No se inventan colores nuevos.

### Tipografía

| Token | Tamaño | Uso | Clase / componente |
| --- | --- | --- | --- |
| `--display-lg` | 48 (40 en ≤800px) | Título de página | `PageHeader` |
| `--display-md` | 40 | Título de página en pantallas angostas | `PageHeader` |
| `--display-sm` | 32 | Cifras de KPI, título de sección | `Stat` |
| `--title-lg` | 24 | Título de estado vacío | `EmptyState` |
| `--title-md` | 20 | Título de tarjeta | `Panel` |
| `--title-sm` | 18 | Subtítulos dentro de una tarjeta | — |
| `--text-lead` | 17 | Descripción bajo el título | `PageHeader` |
| `--text-base` | 15 | Encabezados de tabla (display, mayúsculas) | `DataList` |
| `--text-md` | 14 | Lectura por defecto: tablas, formularios, tarjetas | — |
| `--text-sm` | 13 | Eyebrow (display, mayúsculas), ayudas, paginación | — |
| `--text-xs` | 12 | Texto secundario, badges, tags | `.ds-meta` |

### Espacio, forma y elevación

- **Espacio:** la escala es de 4px (`--space-1` = 4, `--space-2` = 8, `--space-3` = 12, `--space-4` = 16, `--space-5` = 20, `--space-6` = 24, `--space-8` = 32, `--space-10` = 40, `--space-12` = 48).
  - Entre bloques de una página: 20px (`Stack`).
  - Dentro de una tarjeta: 12 a 16px.
  - Entre etiqueta y control: 6px.
- **Radios:**
  - `--radius` (6px): tarjetas, botones y campos.
  - 4px: tags y el aviso `note`.
  - Pill (999px): badges.
- **Página:** ancho máximo `--page-max` (1280px), que sube a `--page-wide-max` (1330px) desde 1450px. El relleno es de 43/32px, y de 32/20px en teléfono.
- **Sombras:** las tarjetas no llevan. `--shadow-raised` es para elementos elevados y `--shadow-overlay` para lo que flota sobre la página.
- **Puntos de quiebre:**
  - 480: teléfono.
  - 600: teléfono grande; las acciones de la cabecera van dos por fila.
  - 800: el título baja a 40.
  - 1100: una columna en `Split`.
  - Las listas responden a su propio ancho (container query), no al de la ventana.

## Componentes

Todos se importan desde `@/components/ds`. Los ejemplos vivos y su código están en `/sistema-diseno`.

| Componente | Para qué |
| --- | --- |
| `Page` | Columna de contenido dentro de `AppShell` (`narrow` para formularios o fichas) |
| `PageHeader` | Eyebrow, título, descripción, acciones y `back` opcional |
| `BackLink` | «← Roles»: vuelve al listado; recibe las props de `Link` |
| `Panel` | La tarjeta de cada bloque, con `title`, `description` y `actions`; `flush` quita el relleno |
| `Stack` / `Split` | Bloques apilados a 20px / contenido más columna lateral de 320px |
| `Badge` | Estado, con `tone` |
| `Tag` / `Tags` | Etiqueta neutra, como un rol o una categoría |
| `Callout` | Mensaje en la página: `note`, `info`, `warning`, `success`, `danger` (se anuncia como alerta) o `sample` |
| `EmptyState` | Nada que mostrar: ícono, qué pasó y una acción (`inline` dentro de una tarjeta) |
| `DescriptionList` | Pares etiqueta → valor de una ficha |
| `FilterBar` / `FilterField` / `SearchInput` | Búsqueda y filtros sobre una lista |
| `DataList` + `DataColumn` | Lista desde una sola definición de columnas: tabla cuando cabe y tarjetas cuando no (`collapseAt`: sm 600, md 880, lg 1100) |
| `Pagination` / `paginate` | Pie de lista y corte de la página en el cliente |
| `IconAction` / `Actions` | Acción de fila con tooltip. Deshabilitada, sigue visible y el tooltip dice el `reason`; `danger` se pone roja al pasar el cursor |
| `ChoiceGrid` / `ChoiceCard` | Casillas como tarjetas (roles, permisos); `locked` mantiene el valor |
| `FormRow` / `FormActions` / `Optional` | Campos lado a lado, botones al final (`sticky` en modales largos) y «(opcional)» |
| `Stat` / `StatRow` | Cifra suelta con su tono |

Para lo que no está aquí se usan las primitivas de shadcn, en `components/ui`:

- `Button`: un solo `default` (rojo) por vista o modal; `outline` para lo secundario; `ghost` para íconos; `destructive` solo para lo que no se deshace.
- `Field`, `Input`, `Select`, `Checkbox`, `Dialog` con `DialogBody` para los modales largos, `AlertDialog` para confirmar, y `Tooltip`.

Los dashboards con gráficos usan `components/dashboard/dashboard-ui.tsx` (`KpiRow`, `DashboardCard`, gráficos y `DataTable`), que siguen los mismos tonos y series.

## Recetas

### Vista de listado

```tsx
export const Route = createFileRoute("/proveedores/")({ component: ProvidersPage });

const columns: DataColumn<Provider>[] = [
  { key: "name", header: "Proveedor", card: "title", cell: p => <Link to="/proveedores/$id" params={{ id: p.id }} className="ds-link">{p.name}</Link> },
  { key: "rut", header: "RUT", card: "title", cell: p => <span className="ds-meta">{p.rut}</span> },
  { key: "status", header: "Estado", cell: p => <Badge tone={providerTone[p.status]}>{p.status}</Badge> },
  { key: "orders", header: "Órdenes", align: "end", cell: p => p.orders },
];

function ProvidersPage() {
  const { current, visible } = paginate(rows, page, pageSize);
  return (
    <AppShell trail={["Abastecimiento", "Proveedores"]}>
      <Page>
        <PageHeader eyebrow="Abastecimiento" title="Proveedores" description="…" actions={<Button><Plus />Nuevo proveedor</Button>} />
        <FilterBar>
          <FilterField id="q" label="Buscar" grow><SearchInput id="q" value={term} onChange={…} /></FilterField>
        </FilterBar>
        <DataList label="Proveedores" rows={visible} columns={columns} rowKey={p => p.id}
          actions={p => <Actions><IconAction label="Editar" onClick={…}><Pencil /></IconAction></Actions>}
          footer={<Pagination page={current} pageSize={pageSize} totalCount={rows.length} onPage={setPage} onPageSize={setPageSize} />} />
      </Page>
    </AppShell>
  );
}
```

`src/routes/roles.index.tsx` es un listado real construido así.

### Vista de detalle

`PageHeader` con `back={<BackLink to="/proveedores">Proveedores</BackLink>}`, el nombre como título y las acciones en la cabecera. Debajo, un `Stack` con:

- un `Callout` si hay algo que avisar;
- un `Split` con los `Panel` del registro (`DescriptionList`) a la izquierda y lo relacionado a la derecha.

Ejemplo real: `src/routes/roles.$id.tsx`.

### Formulario

Crear y editar se hacen en un modal (`Dialog`), no en otra página:

- `DialogBody` para que el contenido haga scroll;
- `Field` de shadcn por campo, con su `FieldError`;
- `FormRow` para poner campos lado a lado;
- `ChoiceGrid` para elegir entre opciones con descripción;
- al final, `FormActions sticky`: «Cancelar» en `outline` primero y la acción principal al final.

Los errores del servidor sin campo van en un `Callout variant="danger"` arriba del formulario.

## Adaptar una vista existente

Las vistas anteriores usan clases propias de cada módulo. Al tocar una, reemplaza su estructura por los componentes. El aspecto se mantiene porque los componentes salieron de esas mismas clases.

| Antes (clase) | Ahora (componente) |
| --- | --- |
| `.my-requests` | `Page` |
| `.eyebrow` + `.page-heading` + `.page-description` + `.access-heading` | `PageHeader` |
| `.access-back` | `BackLink` |
| `.access-card`, `.dashboard-card` sin gráfico, `.requests-table-card` | `Panel` (`flush` para tablas) |
| `.role-layout`, `.detail-grid` | `Split` / `Stack` |
| `.status-badge.status-*` | `Badge tone=…` (ya lo usan `StatusBadge` y `EmployeeStatusBadge`) |
| `.role-chip` | `Tag` |
| `.requests-note` | `Callout variant="note"` |
| `.access-alert` | `Callout variant="danger"` (ya lo usa `ErrorAlert`) |
| `.access-warning` | `Callout variant="warning"` |
| `.sample-notice` | `Callout variant="sample"` |
| `.access-empty`, `.catalog-empty` | `EmptyState` |
| `.detail-list` / `.detail-item` | `DescriptionList` |
| `.filters-bar` / `.filter-field` / `.search-input` | `FilterBar` / `FilterField` / `SearchInput` |
| Tabla + `.access-cards` hechas a mano | `DataList` |
| `.pagination` | `Pagination` (ya lo usan `PaginationFooter` y `AccessPagination`) |
| `.row-actions` / `.row-action` / `ActionButton` | `Actions` / `IconAction` (ya lo usa `ActionButton`) |
| `.role-option`, `.permission-option` | `ChoiceCard` en `ChoiceGrid` |
| `.access-form-row` / `.access-form-actions` | `FormRow` / `FormActions` |
| `.person-link`, `.count-link` / `.person-meta` | `.ds-link` / `.ds-meta` |

Pasos para adaptar una vista:

1. Cambia la estructura por los componentes y borra de `styles.css` las clases que hayan quedado sin uso (búscalas con `grep`).
2. Lo que sea de verdad propio de la vista (un gráfico, un tracker, una matriz) sigue con su clase. Escríbela con tokens.
3. Revisa la vista a 320, 390, 768, 1024 y 1280px, en claro y en oscuro.

### Estado de la migración

- **Ya en el sistema:**
  - las vistas de roles (`/roles` y `/roles/$id`) y la página «sin permiso» de `AccessPage`;
  - los helpers compartidos `StatusBadge`, `EmployeeStatusBadge`, `ErrorAlert`, `ActionButton`, `PaginationFooter` y `AccessPagination`, por lo que todas las tablas y badges ya los usan.
- **Pendientes:** las páginas de solicitudes (`/mis-solicitudes`, `/gestionar-solicitudes`, `/revision-departamento`) con su `FiltersBar`, `/catalogo`, `/empleados`, `/empleados/$id` y `/permisos`, los formularios de empleado y rol, y los diálogos de solicitudes.

## Reglas

- **Clases `ds-*`.** Solo se definen en `ds.css` y se usan a través de los componentes. `.ds-link` y `.ds-meta` son la excepción: se usan directo en celdas.
- **Sin valores literales.** En `ds.css` todo sale de un token. Si falta un valor, se agrega a la escala.
- **Espaciado entre bloques.** Los estilos `ds-*` no están en una capa (`@layer`), así que ganan sobre las utilidades de margen de Tailwind. Para separar componentes usa `Stack` o `gap` en el contenedor, no `className="mt-4"` sobre el componente. Dentro de tu propio contenido, las utilidades de Tailwind sirven para el layout.
- **Componentes de módulo.** Se componen de piezas `ds` y viven en `components/<módulo>/`. Si algo se repite en dos módulos, pásalo a `ds`, con su ejemplo en `/sistema-diseno` y su fila en esta guía.
- **Textos.**
  - En español y en lenguaje de quien usa la app. Los botones dicen lo que hacen: «Invitar empleado», no «Aceptar».
  - Las fechas siguen el formato de `es-CL`.
- **Accesibilidad.**
  - Cada control tiene etiqueta y los íconos solos llevan `aria-label`.
  - Las acciones deshabilitadas explican por qué.
  - Los errores usan `role="alert"`, que `Callout danger` ya pone.
