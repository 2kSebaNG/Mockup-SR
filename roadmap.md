# Nueva solicitud
- [x] Abrir modal desde el menú y mostrar campos según categoría.
- [x] Permitir tipos, campos y opciones personalizados.
- [x] Conectar IA para completar campos y proponer tipos nuevos.
- [x] Verificar flujo manual, IA y pantalla pequeña.

# Mis solicitudes
- [x] Vista con resumen por estado, tabla paginada, búsqueda por código y filtros.
- [x] Orden por fecha límite y aviso de solicitudes próximas a vencer o vencidas.
- [x] Ver, editar (solo Enviada o En revisión) y anular solicitudes.
- [x] Abrir chat interno con quien autoriza (vista previa local).
- [x] Enviar solicitudes desde el modal y listarlas desde el servidor.
- [x] Guardar edición y anulación, validando las reglas también en el servidor.
- [ ] Aplicar la migración `supabase/migrations/20261015120000_create_requests.sql` en Lovable Cloud.
- [ ] Iniciar sesión real y roles (hoy el solicitante es la cuenta demo y cualquiera abre la vista del ADC).
- [ ] Conectar el chat interno real.

# Gestionar solicitudes (Administrador de Contrato)
- [x] Sidebar (shadcn sidebar-07) con la sección Solicitudes: Mis solicitudes y Gestionar solicitudes.
- [x] Bandeja con resumen (autorizadas, delegadas, rechazadas, pendientes), depto. y encargado asignados, solicitante y filtros.
- [x] Detalle: campos del formulario, o requerimiento escrito con la interpretación de IA.
- [x] Autorizar, rechazar o delegar solicitudes Enviadas; reglas validadas en el servidor.
- [x] Delegar con departamento y encargado sugeridos por IA (o por reglas si no hay IA), editables.
- [x] Bandeja del departamento para que el encargado autorice o rechace lo delegado.

# Revisión del departamento
- [x] Vista con las solicitudes delegadas al encargado elegido (departamento y encargado en la URL).
- [x] Autorizar o rechazar solo lo que está En revisión y fue delegado a ese encargado; reglas validadas en el servidor.
- [ ] Reemplazar el selector "Actuar como" por el usuario con sesión iniciada.

# Catálogo de requerimientos
- [x] Tipos, selects y opciones nuevas quedan pendientes en la solicitud; no entran solos al catálogo.
- [x] Marcar lo nuevo en el detalle de la solicitud y en la tabla del ADC.
- [x] El ADC aprueba o rechaza cada novedad, pudiendo corregir el nombre o unirla a una existente.
- [x] Página Catálogo: novedades pendientes agrupadas entre solicitudes y catálogo vigente.
- [x] Los nombres corregidos quedan como alias, así no se vuelven a pedir.
- [ ] Aplicar la migración `supabase/migrations/20261016090000_requirement_catalog.sql` en Lovable Cloud.

# Tipo de elemento y catálogos maestros
- [x] "Tipo de requerimiento" pasa a llamarse "Categoría".
- [x] Campo de elemento siempre presente, con nombre según la categoría (Cargo, Tipo de máquina, Producto…).
- [x] Sugerencias mientras se escribe (debounce de 350 ms) desde el catálogo maestro de la categoría.
- [x] Elementos nuevos quedan pendientes hasta que el ADC los aprueba (con corrección o unión a uno existente).
- [x] Categorías nuevas: EPP, Servicios, Vehículos, Combustibles y lubricantes, con sus catálogos maestros.
- [ ] Aplicar la migración `supabase/migrations/20261017090000_requirement_elements.sql` (pg_trgm) en Lovable Cloud y probar las sugerencias allí.