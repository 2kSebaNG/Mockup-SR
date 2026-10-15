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
- [ ] Bandeja del departamento para que el encargado autorice o rechace lo delegado.