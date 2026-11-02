# Plan: integrar budget-control-web como módulo «Abastecimiento»

Origen: [`2kSebaNG/budget-control-web`](https://github.com/2kSebaNG/budget-control-web), rama `main` (`4f7f32d`, 14 oct 2026).
Destino: este repositorio (Mockup-SR), siguiendo el sistema de diseño (`docs/design-system.md`, `/sistema-diseno`).

## 1. Qué hay en el repo de origen

| | budget-control-web | Mockup-SR |
| --- | --- | --- |
| Framework | Next.js 14 (App Router, `app/(dashboard)`) | TanStack Start + TanStack Router (`src/routes`) |
| Estilos | Tailwind 3. Tokens HSL de los wireframes: gris cálido, acento pizarra `#3f4a5c` y rojo solo de marca. Solo tema claro, fuente del sistema | Tailwind 4. Tokens oklch con tema claro y oscuro, grafito y rojo. Source Sans 3 + Barlow Condensed. Componentes `ds` |
| Navegación | Barra superior con menús desplegables por módulo, que se puede acoplar arriba, a la izquierda o a la derecha (`nav-entries.ts`, `side-nav.tsx`, `dock-menu.tsx`) | Sidebar de shadcn con módulos y subsecciones (`app-sidebar.tsx`, `nav-main.tsx`) y breadcrumb en el header |
| Datos | API real (`budget-control-api`): `openapi-fetch` tipado desde `lib/api/schema.d.ts`, hooks de React Query (`lib/api/use-*.ts`) y filtros en la URL (`useListParams`) | Stores simulados que siguen el contrato de la API: funciones puras más localStorage, como `lib/access.ts` |
| Sesión y permisos | next-auth (Entra ID + magic link); códigos como `purchase-orders:approve` | Sesión simulada de Human360 (`access-store`), catálogo de permisos en `lib/access.ts` |
| Pruebas | Jest (62 specs de `lib/`) y Playwright | Vitest |

Lo bueno para la migración es que casi toda la lógica está en módulos puros de `lib/`: formato, validación de OC, RUT, métricas, fórmulas, proyección, escenarios y proveedores, todos con pruebas. Además, solo dos archivos tienen colores escritos a mano; el resto usa tokens.

### La barra de navegación de origen

| Grupo | Vistas (ruta de origen) | Permiso |
| --- | --- | --- |
| **Reporte** (enlace) | Portafolio `/report` → proyecto `/report/[id]` con pestañas Reporte, Presupuesto (`/budget`) y Plan de abastecimiento (`/procurement-plan`) | — |
| **Abastecimiento** | Órdenes de Compra `/procurement/purchase-orders` (+ `/new`, `/[id]`) | — |
| | Aprobación OC `/procurement/purchase-orders/approvals` | `purchase-orders:approve` |
| | Caja Chica `/procurement/petty-cash` (+ `/new`, `/[id]`) | — |
| | Plan de Abastecimiento `/procurement/procurement-plan` (elige proyecto y lleva a la pestaña del proyecto) | — |
| | Remuneraciones `/procurement/payroll` | — |
| **Negocios** | Negocios `/sales` (+ `/new`, `/[id]`) | — |
| | Proyectos `/projects` (+ `/new`) | `sales:read` |
| | Ventas `/sales/transactions` | — |
| | Escenarios `/scenarios` (+ `/new`, `/[id]`) | — |
| | Vencimientos `/expirations` | `contractual-documents:read` |
| **Administración** | Unidades de Negocio, Cuentas Contables, Proveedores, Clientes, Perfil de la Empresa, Impuestos (SII) | `business-units:manage`, `chart-accounts:manage`, `vendors:read`, `clients:create`, `company:manage` |
| | Usuarios y Roles `/admin/users` (+ `/admin/roles/new`, `/admin/roles/[id]`) | `users:manage` |

Fuera de la barra hay cuatro páginas más:
- el inicio, con `HomeInsights`;
- `/notifications`, a la que se llega desde la campana;
- `/forecast`, que solo redirige a los proyectos;
- el login.

## 2. La sección en la sidebar

La barra superior desaparece. Todo pasa a un módulo **Abastecimiento** en la sidebar, con las mismas cuatro secciones de la barra de origen. Se usa el mismo patrón que «Recursos Humanos → Personas y accesos»: `NavMain` ya acepta en el segundo nivel tanto enlaces directos como subsecciones desplegables.

```
Abastecimiento                         (ícono Package)
├─ Reporte                             /abastecimiento/reporte
├─ Compras ▸                           (en el origen: «Abastecimiento», ver decisión 1)
│   ├─ Órdenes de compra               /abastecimiento/ordenes-compra
│   ├─ Aprobación OC                   /abastecimiento/ordenes-compra/aprobacion      purchase-orders:approve
│   ├─ Caja chica                      /abastecimiento/caja-chica
│   ├─ Plan de abastecimiento          /abastecimiento/plan
│   └─ Remuneraciones                  /abastecimiento/remuneraciones
├─ Negocios ▸
│   ├─ Negocios                        /abastecimiento/negocios
│   ├─ Proyectos                       /abastecimiento/proyectos                      sales:read
│   ├─ Ventas                          /abastecimiento/ventas
│   ├─ Escenarios                      /abastecimiento/escenarios
│   └─ Vencimientos                    /abastecimiento/vencimientos                   contractual-documents:read
└─ Administración ▸
    ├─ Unidades de negocio             /abastecimiento/admin/unidades                  business-units:manage
    ├─ Cuentas contables               /abastecimiento/admin/cuentas                   chart-accounts:manage
    ├─ Proveedores                     /abastecimiento/admin/proveedores               vendors:read
    ├─ Clientes                        /abastecimiento/admin/clientes                  clients:create
    ├─ Perfil de la empresa            /abastecimiento/admin/empresa                   company:manage
    ├─ Impuestos (SII)                 /abastecimiento/admin/impuestos                 company:manage
    └─ Usuarios y roles                → Personas y accesos (ver decisión 2)
```

Páginas internas, que no aparecen en la sidebar pero mantienen resaltado su ítem:

| Vista | Ruta |
| --- | --- |
| Detalle de proyecto | `/abastecimiento/reporte/$projectId` |
| Presupuesto del proyecto | `…/$projectId/presupuesto` |
| Plan del proyecto | `…/$projectId/plan` |
| Nueva OC | `/abastecimiento/ordenes-compra/nueva` |
| Detalle de OC | `/abastecimiento/ordenes-compra/$id` |
| Rendición de caja chica | `/abastecimiento/caja-chica/$id` |
| Negocio | `/abastecimiento/negocios/$id` |
| Escenario | `/abastecimiento/escenarios/$id` |
| Notificaciones | `/abastecimiento/notificaciones` |

Cómo funciona:
- **Breadcrumb:** el `trail` de `AppShell` refleja la sección, por ejemplo `["Abastecimiento", "Compras", "Órdenes de compra"]`.
- **Permisos:** el menú se filtra como hoy se filtra Personas y accesos (`can(state, permiso)`). Un grupo sin ítems visibles no se muestra.
- **Prefijo `/abastecimiento/`:** evita choques con rutas existentes (`/roles`) y deja el módulo identificable.
- **Resaltado en `NavMain`:** hoy marca activo todo ítem cuya ruta es prefijo de la actual, así que en `/ordenes-compra/aprobacion` quedarían marcados «Órdenes de compra» y «Aprobación OC». Hay que cambiarlo para que gane la coincidencia más larga.
- **Botón «Módulos» del header:** suma el acceso a Abastecimiento.

## 3. Cómo se traduce cada pieza

### Del framework

| Next.js (origen) | TanStack (destino) |
| --- | --- |
| `app/(dashboard)/x/page.tsx` + `'use client'` | `src/routes/abastecimiento.x.tsx` con `createFileRoute` |
| `useSearchParams` + `useListParams` (filtros en la URL) | `validateSearch` + `Route.useSearch()` + `navigate({ search })`, igual que `/empleados` |
| `useRouter().push`, `<Link href>` | `useNavigate()`, `<Link to params>` |
| `layout.tsx` con `auth()` | `AccessPage` (sesión y permiso) dentro de `AppShell` |
| `app/api/export/email/route.ts` | `createServerFn` (fase 5) |
| `zustand` (solo guarda dónde va acoplada la barra) | Se elimina junto con la barra |

### De los datos

Recomendación: un **store simulado con el contrato de budget-control-api**, igual que se hizo con Human360. Los pasos:

1. Copiar `lib/api/schema.d.ts` (es un archivo generado) como `src/lib/abastecimiento/api-schema.d.ts`, para que los tipos sean los de la API.
2. Crear `src/lib/abastecimiento/*.ts` con operaciones puras que devuelvan la misma respuesta que la API: datos, o estado, código y detalle de error. Se agrega un seed por dominio: proyectos, proveedores, cuentas, OC, rendiciones, negocios, escenarios y documentos.
3. Exponer los hooks de React Query **con los mismos nombres** (`usePurchaseOrders`, `useVendors`…) sobre el store. Así las páginas se portan casi tal cual, y conectar después la API real es cambiar el cuerpo de cada hook por `openapi-fetch`.
4. Copiar los módulos puros de `lib/` (formato, `purchase-order`, `rut`, `metrics`, `formula*`, `projection-*`, `scenario-*`, `vendors`, `tax-rates`…) a `src/lib/abastecimiento/`, junto con sus pruebas. Jest pasa a Vitest cambiando `jest.fn` por `vi.fn`.

### Del diseño

Estas son las equivalencias. La guía del sistema de diseño tiene la tabla general.

| Origen | Destino |
| --- | --- |
| `WireframePage` + `PageTopbar` (barra blanca de borde a borde, con título, chip y acciones) | `Page` + `PageHeader` (eyebrow con la sección, título, descripción y acciones). El chip pasa a `Badge` o `Tag` |
| `FilterBar` y `FilterPill` de los wireframes | `FilterBar` del sistema; las pastillas pasan a un filtro segmentado (nuevo, ver más abajo) |
| `ui/table` + `TableSkeleton` + `ui/pagination` | `DataList` (tabla, o tarjetas cuando no cabe) + `Pagination` + esqueleto de lista |
| `Badge` con `success`, `warning`, `destructive`… | `Badge tone=…` (tonos en la tabla siguiente) |
| `Card` | `Panel` |
| Formularios en página propia (`/new` de rendición, proyecto, negocio y escenario) | Modales (`Dialog` + `FormRow` + `FormActions sticky`), como invitar empleado. La **nueva OC** sigue siendo página: es un flujo largo con stepper, proveedor, líneas y respaldo |
| Gráficos SVG propios (`bar-compare`, `donut`, `month-chart`, `rank-bars`, `chart-card`) | `dashboard-ui.tsx`: `DashboardCard`, `Donut`, barras y líneas sobre shadcn chart, con las series `--series-*` |
| Selectores (`account-combobox`, `vendor-picker`, `project-select`…) | `Popover` + `Command` de shadcn (ya están en `components/ui`) |
| `rut-input`, `currency-input` | Nuevos en `ds`: `RutInput` (reusa `formatRut` y `normalizeRut` de `access.ts`, que pasan a `lib/rut.ts`) y `MoneyInput` (CLP) |
| Visor de PDF e imágenes, adjuntos | `components/abastecimiento/` sobre `Dialog` |
| Campana de notificaciones y chip de usuario | La campana pasa al header (`SiteHeader`) y lleva a `/abastecimiento/notificaciones`; el usuario ya está en `NavUser` |
| Pantallas que ocupan toda la ventana (`--shell-width`, `--shell-top`) | `Page` con una variante a todo el ancho (nueva); las grillas miden su contenedor, no la ventana |
| Primario pizarra, rojo solo de marca | Primario rojo: **un solo** botón `default` por vista. Lo demás va en `outline` o `ghost` |

Estados por tono:

| Dominio | Estado → tono |
| --- | --- |
| Órdenes de compra | Borrador → neutral · Enviada → warning (espera decisión) · Aprobada → progress (falta pagar) · Pagada → success · Rechazada → danger · Anulada → neutral |
| Proyecto | Activo → success · En cierre → warning · Cerrado → neutral |
| Negocio | Activo → success · Cerrado → neutral |
| Caja chica | Abierta → info · Cerrada → success |
| Documento contractual | Vigente → success · Por vencer → warning · Vencida → danger |

### Lo que se suma al sistema de diseño

Se agrega en la fase 0, con su ejemplo en `/sistema-diseno` y su fila en la guía, porque más de una vista lo necesita:
- `Page full`, a todo el ancho, para el reporte, el proyecto, el plan y los escenarios.
- `Tabs` de página para las pestañas del proyecto (Reporte, Presupuesto, Plan).
- `SegmentedFilter`, el filtro de pastillas por estado con conteo: «Pendientes 4».
- `Stepper`, el avance de la OC: Borrador → Enviada → Aprobada → Pagada.
- `MasterDetail`, la cola de aprobación: lista a la izquierda y detalle a la derecha, que en teléfono pasa a una sola columna.
- `MoneyInput`, `RutInput` y `DataListSkeleton`.
- `Combobox`, un selector con búsqueda sobre `Command`.

## 4. Fases

Cada fase va en su propia rama `feature/abastecimiento-<fase>` y su PR, y deja la app funcionando. Antes de cerrarla se revisa cada vista a 320, 390, 768, 1024 y 1280 px, en claro y en oscuro, y se corren tsc, lint, Vitest y build.

### Fase 0: base (sin vistas finales) — hecha

Lo que quedó, para quien siga con la fase 1:
- **Navegación:** `src/lib/abastecimiento/navigation.ts` declara cada vista una vez (título, ruta, permiso, descripción, fase y origen). De ahí salen la sidebar, el breadcrumb (`procurementTrail`) y la página «en construcción» (`components/abastecimiento/view-in-progress.tsx`) de cada ruta. Una vista nueva reemplaza el `component` de su archivo en `src/routes/abastecimiento.*.tsx`. `/abastecimiento` lleva al Reporte y «Usuarios y roles» a `/empleados`. El módulo no aparece cuando la persona solo tendría ese acceso.
- **Permisos:** los códigos de budget-control-api están en el catálogo de `lib/access.ts`, sin `users:manage`. Hay dos roles de ejemplo nuevos, «Abastecimiento» (Daniela Vera, `dvera@aecon.cl`) y «Aprobador de OC» (Tomás Bravo, `tbravo@aecon.cl`). El store de accesos pasó a `ecosistema-x.access.v3` para tomar el seed nuevo.
- **Datos:** `api/schema.d.ts` es copia del origen en `4f7f32d`. `data.ts` tiene el seed y las lecturas de los catálogos: unidades, cuentas, impuestos, empresa, clientes, negocios, proyectos y personas. `store.ts` los guarda en localStorage (`ecosistema-x.abastecimiento.v1`) y `hooks.ts` expone `useBusinessUnits`, `useChartAccounts`, `useTaxRates`, `useCurrentTaxRates`, `useCompany`, `useClients`, `useDeals`, `useProjects`, `useProjectItems` y `usePeople`, con las mismas claves de consulta del origen. Las escrituras (`mutate`) se agregan con las vistas que las usan.
- **Lógica pura:** los 55 módulos puros de `lib/` del origen están en `src/lib/abastecimiento/` y sus pruebas en `src/test/abastecimiento/` (55 archivos y 690 pruebas, de Jest a Vitest; más las pruebas del seed en `data.test.ts`). Para compilar con las reglas de este repo (índices posiblemente indefinidos, propiedades opcionales exactas) se agregaron aserciones `!` y `| undefined`, sin cambiar el comportamiento.
- **Sistema de diseño:** `Page full`, `PageTabs`, `SegmentedFilter`, `Stepper`, `MasterDetail`, `Combobox`, `MoneyInput`, `RutInput` y `DataListSkeleton`, con su ejemplo en `/sistema-diseno` (sección «Flujos y selección»). `RutInput` usa `formatRut` y `normalizeRut` de `lib/access.ts`, donde siguen.
- **Pendiente:** el botón «Módulos» del header todavía no abre ningún menú; cuando lo tenga, se suma Abastecimiento.

Lo planificado era:

1. Agregar la sección Abastecimiento a `app-sidebar.tsx` con la estructura de §2. Cada ruta tiene un placeholder que dice «En construcción», y `NavMain` se ajusta para la coincidencia más larga.
2. Sumar los permisos de budget-control al catálogo de `lib/access.ts`, en los módulos de `permission-catalog.ts` (Órdenes de compra, Caja chica, Plan, Remuneraciones, Presupuesto/escenarios/negocios, Administración). También asignarlos en los roles de ejemplo, por ejemplo un rol «Abastecimiento» y otro «Aprobador OC».
3. Crear la capa de datos (`src/lib/abastecimiento/`): esquema, operaciones, seed, hooks y lógica pura con sus pruebas.
4. Agregar los componentes nuevos del sistema de diseño de §3.

### Fase 1: Administración (las vistas más simples)

Va primero porque prueba `DataList`, los modales y los permisos con poco riesgo, y porque crea los catálogos que usan las demás.

| Vista | Qué tiene | Tamaño |
| --- | --- | --- |
| Unidades de negocio | Tabla, alta en tarjeta, renombrar y desactivar | S |
| Impuestos (SII) | Tasas por fecha y reajustes | S |
| Perfil de la empresa | Formulario (membrete del PDF) | S |
| Clientes | Tabla, edición en fila, negocios por cliente | M |
| Cuentas contables | Árbol con arrastre, conflictos de tipo | M |
| Proveedores | Tabla paginada por URL, formulario largo, categorías, métricas, exportar | L |

### Fase 2: Compras

| Vista | Qué tiene | Tamaño |
| --- | --- | --- |
| Órdenes de compra | Lista con estado, proyecto, búsqueda, orden y página en la URL | M |
| Detalle de OC | Flujo de aprobación, revisiones, adjuntos y anulación | M |
| Nueva OC | Stepper, proveedor (buscar o crear), líneas, impuestos y respaldo | L |
| Aprobación OC | Cola maestro-detalle, aprobar o rechazar con motivo | M |
| Caja chica | Lista; la nueva rendición pasa a modal | S |
| Rendición | Gastos con su boleta y proyecto; al cerrar genera las OC por proyecto | L |
| Plan de abastecimiento | Selector de proyecto que lleva a la pestaña del proyecto (fase 4) | S |
| Remuneraciones | Asignaciones por persona, totales, dar de baja, importar/exportar la nómina | L |

### Fase 3: Negocios

| Vista | Qué tiene | Tamaño |
| --- | --- | --- |
| Negocios | Lista; el nuevo negocio pasa a modal | S |
| Negocio | Datos, proyectos, anexos y conciliación de contratos | L |
| Proyectos | Lista con filtros; el nuevo proyecto pasa a modal | S |
| Ventas | Estados de pago por proyecto y total | S |
| Vencimientos | Documentos por urgencia, filtro segmentado, ver PDF y renovar | M |
| Escenarios | Lista y árbol de escenarios; el nuevo escenario pasa a modal | M |
| Escenario | Panel de referencia y ajustado, constructor de ajustes e historial | L |

### Fase 4: Reporte (lo más pesado)

| Vista | Qué tiene | Tamaño |
| --- | --- | --- |
| Portafolio | Tabla de proyectos con KPIs, modo concentración y fijados | L |
| Proyecto, pestaña Reporte | `projection-grid` (1.679 líneas): mensual o por período, proyección escrita en la celda, borrador, escenario, cálculos flotantes, alertas | XL |
| Proyecto, pestaña Presupuesto | Versiones P0–P3, editor e importación del IC | L |
| Proyecto, pestaña Plan | Grilla del plan y emisión de OC por mes | L |

Las grillas conservan su lógica, que está en `lib/` y ya tiene pruebas. Se reescriben solo sus estilos: usan tokens, se ven en oscuro y se encabezan como `DataList`, con display en mayúsculas sobre `--secondary`. En teléfono mantienen la lista de cuentas que ya tienen (`phone-account-list`).

### Fase 5: lo transversal

- Campana en el header y página de notificaciones.
- Exportar a PDF o imagen y enviar por correo (`html-to-image` y una server function).
- Resumen del módulo con los `HomeInsights` del inicio de origen. Puede ser la portada de Reporte o una tarjeta en Inicio.
- Conectar los hooks a `budget-control-api` real cuando corresponda.

## 5. Decisiones abiertas

1. **Nombre del grupo «Abastecimiento» dentro del módulo «Abastecimiento».** Repetido se lee raro en la sidebar y en el breadcrumb («Abastecimiento › Abastecimiento › Caja chica»). Recomiendo **«Compras»**; la alternativa es «Órdenes y gastos».
2. **Usuarios y roles.** Mockup-SR ya tiene empleados, roles y permisos de Human360, y el README de budget-control dice que es parte del mismo ecosistema. Recomiendo **no duplicar**: el ítem lleva a Personas y accesos, y los permisos de budget-control se suman al catálogo de roles de ahí. La alternativa es portar el editor de roles propio.
3. **Datos.** Recomiendo store simulado con el contrato de la API (§3). La alternativa es conectar desde el inicio la API real, que necesita que el backend esté levantado y una sesión real.
4. **Formularios de alta.** Recomiendo modales, según el sistema de diseño, salvo la nueva OC. La alternativa es mantener páginas como en el origen.

## 6. Riesgos

- **La grilla de proyección** concentra la mayor parte del comportamiento: edición en celda, borrador, escenarios y foco. Hay que portarla sin tocar su lógica y con pruebas de paridad, antes de cambiarle el aspecto.
- **Diferencias de framework** en el manejo de la URL. Next serializa los filtros con `useListParams`; TanStack los valida con `validateSearch`. Conviene un helper compartido que lea y escriba los mismos parámetros.
- **Tema oscuro:** el origen nunca lo tuvo. Todo color sale de tokens, incluidos los dos archivos con colores escritos a mano.
- **El contrato de la API puede moverse:** `schema.d.ts` se vuelve a copiar cuando cambie `openapi.yaml`. Hay que anotar en el código la versión copiada.
