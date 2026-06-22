# Checklist de producción — Transporte Rosario Perez

Documento operativo para el primer deploy y puesta en marcha del ERP.

**Alcance:** MVP single-tenant (Vercel + Supabase + DigitalOcean Spaces + WhatsApp).  
**Última actualización:** junio 2026.

---

## Cómo usar este documento

1. Completá las fases **en orden** (1 → 2 → 3 → 4).
2. Marcá cada ítem con `[x]` cuando esté hecho.
3. No des acceso a usuarios finales hasta terminar **Fase 3** (smoke test).
4. La **Fase 5** (seguridad reforzada) es obligatoria antes de sumar muchos usuarios.

---

## Fase 1 — Supabase (base de datos y auth)

### Proyecto

- [ ] Proyecto Supabase creado (región cercana a Argentina, ej. `sa-east-1` si está disponible)
- [ ] Plan elegido (Free sirve para pruebas; **Pro recomendado** para backups PITR en prod)
- [ ] Auth con **email/password** habilitado
- [ ] Registro público deshabilitado o controlado (la app redirige `/app/register` → login)

### Migraciones SQL

Ejecutar en el **SQL Editor** de Supabase, **en este orden**:

| # | Archivo | Obligatorio | Notas |
|---|---------|-------------|-------|
| 1 | `supabase/migrations/001_initial_schema.sql` | Sí | Schema base + perfiles |
| 2 | `supabase/migrations/002_seed_config.sql` | Sí | Categorías de gasto |
| 3 | `supabase/migrations/004_legacy_fields.sql` | Solo legado | Si migrás desde el sistema anterior |
| 4 | `supabase/migrations/005_mvp_alerts.sql` | Sí | Alertas WhatsApp + `notification_log` |
| 5 | `supabase/migrations/006_entity_documents_freeform.sql` | Sí | Documentos libres por entidad |
| 6 | `supabase/migrations/007_document_renewal_and_history.sql` | Sí | Renovación e historial |
| 7 | `supabase/migrations/008_billing_clients_and_proforma_lines.sql` | Sí | Clientes facturación + líneas proforma |
| 8 | `supabase/migrations/009_inventory.sql` | Si usan inventario | Stock y movimientos |
| 9 | `supabase/migrations/010_soft_delete.sql` | Sí | Papelera (`deleted_at`) |
| 10 | `supabase/migrations/011_trip_observations_soft_delete.sql` | Sí | Soft delete observaciones |
| 11 | `supabase/migrations/012_trip_unit_price.sql` | Sí | Precio/pallet estimado y real |

- [ ] Migraciones 001, 002, 005, 006, 007, 008, 010, 011, 012 ejecutadas sin error
- [ ] Migración 004 ejecutada (obligatoria si migrás desde Neon/legado)
- [ ] Migración 009 ejecutada (si corresponde)
- [ ] Tabla `company_settings` tiene un registro (seed de 001)
- [ ] Verificado en Table Editor: tablas `profiles`, `trips`, `entity_documents`, `notification_log` existen

### Usuarios

- [ ] Usuario admin creado en **Authentication → Users** (email + contraseña)
- [ ] Perfil creado en tabla `profiles` (trigger `handle_new_user` o manual)
- [ ] Rol del admin definido (`superadmin` o `admin`) en `profiles.role`
- [ ] Contraseña inicial comunicada de forma segura (no por WhatsApp sin cifrar)

### Datos iniciales (opcional según arranque)

- [ ] Nombre de empresa actualizado en **Configuración → Empresa** (o `company_settings.name`)
- [ ] Clientes, flota y choferes cargados (manual o `pnpm migrate:legacy`)
- [ ] Categorías de gasto revisadas en **Configuración → Gastos**

### Migración desde legado (solo si aplica)

**Orden:** primero **todas** las migraciones SQL (001→012), después el script de datos.

- [ ] `LEGACY_DATABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`
- [ ] `pnpm migrate:legacy -- --dry-run` ejecutado y revisado
- [ ] `pnpm migrate:legacy` ejecutado (clientes → arcor_clients, viajes con arcor_client_id)
- [ ] Viajes, PDFs y maestros verificados post-migración
- [ ] Clientes de **facturación** cargados manualmente en Clientes (no vienen del legado)

---

## Fase 2 — DigitalOcean Spaces (archivos)

- [ ] Bucket creado (dedicado para prod, no compartir con dev)
- [ ] Región y endpoint anotados (`nyc3`, etc.)
- [ ] Access Key + Secret Key generadas (permisos mínimos: solo ese bucket)
- [ ] CORS configurado si hace falta subida directa desde el browser
- [ ] Política de acceso: archivos privados + URLs firmadas (comportamiento actual de la app)

Variables a configurar:

- [ ] `DO_SPACES_ENDPOINT`
- [ ] `DO_SPACES_REGION`
- [ ] `DO_SPACES_BUCKET` (nombre explícito, **no** depender del fallback del código)
- [ ] `DO_SPACES_ACCESS_KEY`
- [ ] `DO_SPACES_SECRET_KEY`

---

## Fase 3 — Vercel (deploy de la app)

### Proyecto

- [ ] Repositorio conectado a Vercel
- [ ] Rama de producción definida (`main` o la que usen)
- [ ] Build exitoso (`pnpm build` local sin errores críticos)
- [ ] Plan Vercel con **Cron Jobs** habilitado (requerido para alertas automáticas)

### Variables de entorno en Vercel

Copiar desde `.env.example`. Marcar cada una:

**Supabase**

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (solo server; nunca exponer al cliente)

**Cron**

- [ ] `CRON_SECRET` — generar con: `openssl rand -hex 32`

**DigitalOcean Spaces**

- [ ] `DO_SPACES_ENDPOINT`
- [ ] `DO_SPACES_REGION`
- [ ] `DO_SPACES_BUCKET`
- [ ] `DO_SPACES_ACCESS_KEY`
- [ ] `DO_SPACES_SECRET_KEY`

**WhatsApp (elegir un proveedor)**

Twilio (default):

- [ ] `WHATSAPP_PROVIDER=twilio`
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_WHATSAPP_FROM`

Meta Cloud API (alternativa):

- [ ] `WHATSAPP_PROVIDER=meta`
- [ ] `WHATSAPP_ACCESS_TOKEN`
- [ ] `WHATSAPP_PHONE_NUMBER_ID`

**Solo migración legado (no en Vercel prod salvo que corran el script ahí)**

- [ ] `LEGACY_DATABASE_URL` — solo entorno local/CI de migración

### Deploy

- [ ] Primer deploy a producción completado
- [ ] URL de prod accesible (ej. `https://tu-app.vercel.app`)
- [ ] Dominio custom configurado (opcional pero recomendado)
- [ ] HTTPS activo en dominio final

### Cron automático

Configurado en `vercel.json`:

- Ruta: `GET /api/cron/document-alerts`
- Horario: `0 11 * * *` (11:00 UTC ≈ **08:00 ART**)

- [ ] Cron visible en Vercel → **Cron Jobs**
- [ ] Primera ejecución verificada (al día siguiente o forzada manualmente)

---

## Fase 4 — WhatsApp (alertas preventivas)

### Proveedor productivo

**Twilio**

- [ ] Salir del sandbox de pruebas
- [ ] Número WhatsApp productivo aprobado
- [ ] Destinatarios pueden recibir mensajes sin opt-in de sandbox

**Meta**

- [ ] App de Meta Business verificada
- [ ] Número conectado a Cloud API
- [ ] Templates aprobados si aplica (mensajes proactivos fuera de ventana 24h)

### Configuración en la app

Ir a **Configuración → Notificaciones**:

- [ ] Alertas **activadas**
- [ ] Teléfonos destino cargados (formato internacional sin `+`, uno por línea)
- [ ] **Días de anticipación** definidos (default: 7)
- [ ] Panel muestra proveedor como **Configurado** (env vars OK)

### Prueba del cron

```bash
# Reemplazá URL y secret
curl -s -H "Authorization: Bearer TU_CRON_SECRET" \
  https://TU-DOMINIO.vercel.app/api/cron/document-alerts | jq .
```

Respuestas válidas:

- `{ "ok": true, "alertsCount": N, "messagesSent": M }` — envió avisos
- `{ "ok": true, "skipped": true, "reason": "..." }` — sin avisos hoy (normal)

- [ ] Cron responde `200` con `Authorization: Bearer` correcto
- [ ] Cron responde `401` sin token o con token inválido
- [ ] Documento de prueba con vencimiento en N días (`alert_days_before`)
- [ ] Registro en tabla `notification_log` (Supabase)
- [ ] Mensaje WhatsApp recibido en teléfono de prueba
- [ ] Campanita de la navbar muestra el mismo documento como “Pronto a vencer”

---

## Fase 5 — Smoke test funcional (antes de go-live)

### Auth

- [ ] Login en `/app/login` con usuario prod
- [ ] Rutas `/app/*` bloqueadas sin sesión
- [ ] Cerrar sesión funciona

### Maestros

- [ ] Alta/edición de cliente
- [ ] Alta/edición de vehículo (flota)
- [ ] Alta/edición de chofer

### Viajes

- [ ] Crear viaje nuevo
- [ ] Cargar gastos
- [ ] Cargar facturación / ingresos
- [ ] Ver resultado económico del viaje
- [ ] Generar o subir PDF del viaje (requiere Spaces)

### Proformas

- [ ] Crear proforma manual
- [ ] Asociar viajes facturables

### Documentos y vencimientos

- [ ] Subir documento en ficha de entidad (vehículo/chofer/empresa)
- [ ] Documento aparece en `/app/documentos` cuando está por vencer o vencido
- [ ] Renovar documento y ver historial

### Inventario (si aplica)

- [ ] Ítems de inventario visibles
- [ ] Movimiento de stock registrado

### Dashboard y reportes

- [ ] Dashboard carga KPIs sin error
- [ ] Reportes accesibles según rol del usuario

---

## Fase 6 — Seguridad (antes de multi-usuario)

> **Estado actual del código:** RLS permite acceso total a cualquier usuario autenticado. Los roles filtran solo el menú lateral, no las mutaciones del servidor.

- [ ] Usuarios creados **solo** desde Supabase Dashboard (no registro público)
- [ ] Rol asignado explícitamente en `profiles.role` por usuario
- [ ] Contraseñas fuertes definidas para cada usuario
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en Vercel (nunca en cliente ni repo)
- [ ] `CRON_SECRET` único y largo (32+ bytes hex)
- [ ] `.env.local` y secretos **no** commiteados a git
- [ ] Revisar que `DO_SPACES_BUCKET` apunta al bucket de prod

### Recomendado implementar antes de escalar

- [ ] Endurecer RLS en Supabase (políticas por rol o tenant)
- [ ] Validar roles en `lib/actions/*` (no solo en sidebar)
- [ ] Cambiar default de signup de `superadmin` a `ops` en trigger de Auth
- [ ] Quitar `ignoreBuildErrors: true` en `next.config.mjs` y corregir errores TS
- [ ] Flujo “olvidé mi contraseña” (Supabase reset email)
- [ ] Monitoreo de fallos del cron (alerta si `{ "ok": false }`)

---

## Fase 7 — Operación y mantenimiento

### Backups

- [ ] Backups automáticos de Supabase activos (PITR en plan Pro)
- [ ] Procedimiento documentado de restore de base de datos
- [ ] Política de retención en DigitalOcean Spaces (versionado o backup periódico)

### Monitoreo

- [ ] Logs de Vercel revisables (Functions / Cron)
- [ ] Vercel Analytics activo (ya integrado en `app/layout.tsx`)
- [ ] Error tracking configurado (Sentry u otro) — **pendiente en código**
- [ ] Contacto/responsable definido para incidentes

### Rutina post go-live

| Frecuencia | Tarea |
|------------|-------|
| Diaria | Revisar que el cron de alertas corrió (Vercel Cron Jobs) |
| Semanal | Revisar vencimientos en `/app/documentos` |
| Mensual | Revisar usuarios activos y roles en Supabase |
| Mensual | Verificar espacio en DO Spaces |

---

## Fase 8 — Pendientes conocidos (no bloquean MVP)

Estas funcionalidades están incompletas o son stub; no impiden operar viajes, gastos, proformas y vencimientos:

- [ ] Gestión de equipo (`/app/equipo`) — invitaciones en iteración futura
- [ ] Emisión de facturas AFIP — schema existe, sin CRUD de emisión
- [ ] `alert_webhook_url` en DB — columna sin implementación en código
- [ ] Tests automatizados — no hay suite de tests
- [ ] CI/CD (GitHub Actions) — no configurado

---

## Resumen rápido — mínimo para salir a prod

Para **Transporte Rosario Perez** con 2–3 usuarios de confianza:

```
[ ] Supabase: migraciones 001→002→004→005→006→007→008→010→011→012 (+009 si inventario)
[ ] migrate:legacy (después de las SQL, si hay datos en Neon)
[ ] Usuario admin en Supabase Auth
[ ] Vercel: deploy + todas las env vars
[ ] DO Spaces: bucket prod + keys
[ ] WhatsApp: proveedor productivo + config en la app
[ ] Cron probado con curl + mensaje recibido
[ ] Smoke test: login → viaje → documento → alerta navbar
```

---

## Referencias en el repo

| Recurso | Ubicación |
|---------|-----------|
| Variables de entorno | `.env.example` |
| Config cron | `vercel.json` |
| API cron | `app/api/cron/document-alerts/route.ts` |
| Lógica alertas | `lib/notifications/document-alerts.ts` |
| README general | `README.md` |
| Migraciones | `supabase/migrations/*.sql` |

---

## Registro de deploy

Completar al finalizar el go-live:

| Campo | Valor |
|-------|-------|
| Fecha go-live | |
| URL producción | |
| Proyecto Supabase | |
| Responsable técnico | |
| Usuarios iniciales | |
| Proveedor WhatsApp | Twilio / Meta |
| Notas / incidencias | |
