# RemitoListo ERP

ERP para transportistas — Next.js App Router, SSR, Server Actions y Supabase (single-tenant).

## Requisitos

- Node 20+
- Proyecto [Supabase](https://supabase.com) con Auth (email/password)
- Deploy en [Vercel](https://vercel.com) (cron diario de alertas)
- Cuenta Twilio WhatsApp sandbox o Meta Cloud API (pruebas de alertas)

## Configuración

1. Copiá `.env.example` a `.env.local` y completá las variables.
2. En el SQL Editor de Supabase, ejecutá **en orden** (001 → 012). Ver tabla completa en `docs/CHECKLIST-PRODUCCION.md`.
3. Si migrás desde el sistema anterior: **después** de todas las SQL, `pnpm migrate:legacy -- --dry-run` y luego `pnpm migrate:legacy`.
4. Creá un usuario en **Authentication → Users** (email/password).
5. `pnpm install && pnpm dev`

### Variables de entorno

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron de alertas + migración legacy |
| `CRON_SECRET` | Bearer token para `/api/cron/document-alerts` |
| `WHATSAPP_PROVIDER` | `twilio` (default) o `meta` |
| `TWILIO_*` / `WHATSAPP_*` | Credenciales del proveedor de WhatsApp |
| `DO_SPACES_*` | Subida/descarga de PDFs e imágenes de documentos |
| `LEGACY_DATABASE_URL` | Solo script `pnpm migrate:legacy` |

### Alertas WhatsApp (preventivas)

**Política:** WhatsApp avisa **antes** de vencer (`expiring_soon`). Los documentos **ya vencidos** aparecen en Vencimientos pero **no** generan mensaje.

**Envío:** 1 resumen agrupado por día × cantidad de teléfonos configurados (no 1 mensaje por documento).

**Hitos por documento:** al entrar en la ventana de anticipación + a 3 días del vencimiento (máx. 2 avisos WhatsApp por ciclo).

1. Credenciales en `.env.local` — ver `.env.example`.
2. **Configuración → Notificaciones**: activar alertas, teléfonos y días de anticipación (default 7).
3. Cron: `GET /api/cron/document-alerts` con `Authorization: Bearer <CRON_SECRET>`.
4. Horario en `vercel.json`: `0 11 * * *` (11:00 UTC ≈ 08:00 ART).

**Twilio (default):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`  
Usá el [sandbox de Twilio](https://www.twilio.com/docs/whatsapp/sandbox) para pruebas sin costo de producción.

**Meta:** `WHATSAPP_PROVIDER=meta`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

## Checklist — probar entorno completo

### Base de datos y auth
- [ ] Migraciones 001 → 002 → 005 → 006 ejecutadas en Supabase
- [ ] Usuario creado en Supabase Auth
- [ ] Login en `/app/login`

### Operación
- [ ] Clientes, flota, choferes CRUD
- [ ] Viaje con gastos y facturación
- [ ] Proforma manual
- [ ] Documento cargado desde ficha de entidad (nombre + vencimiento + archivo opcional)
- [ ] Documento visible en **Vencimientos** (`/app/documentos`) cuando está por vencer o vencido

### Alertas
- [ ] `CRON_SECRET` y credenciales WhatsApp en `.env.local`
- [ ] Configuración → Notificaciones: alertas ON + teléfono(s)
- [ ] Documento de prueba con vencimiento en N días (`alert_days_before`, ej. 7) o en 3 días
- [ ] Prueba manual del cron:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/document-alerts
```

Respuesta esperada: `{ "ok": true, "alertsCount": N, "messagesSent": M }` o `{ "skipped": true }`.

- [ ] Registro en tabla `notification_log` (Supabase)
- [ ] WhatsApp recibido en teléfono de prueba

### Producción (Vercel)
- [ ] Proyecto deployado con todas las env vars
- [ ] `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, Twilio/Meta configurados en Vercel
- [ ] Cron automático activo (plan Vercel con crons habilitados)
- [ ] Verificar primera corrida al día siguiente o forzar desde Vercel → Cron Jobs

**Checklist completo de producción:** [`docs/CHECKLIST-PRODUCCION.md`](docs/CHECKLIST-PRODUCCION.md)  
**Guía de flujos operativos:** [`docs/GUIA-FLUJOS-OPERATIVOS.md`](docs/GUIA-FLUJOS-OPERATIVOS.md)  
**Guía para Notion (usuarios):** [`docs/GUIA-NOTION-USUARIO.md`](docs/GUIA-NOTION-USUARIO.md)

## Arquitectura

- **Páginas**: Server Components en `app/app/(authenticated)/`
- **Datos**: `lib/data/*` (lecturas con `React.cache`)
- **Mutaciones**: `lib/actions/*` (`'use server'`)
- **Auth**: `middleware.ts` + `@supabase/ssr`
- **Cron**: Vercel Cron → `/api/cron/document-alerts` → Twilio/Meta (no Supabase pg_cron)
- **Documentos**: carga desde ficha de entidad; Vencimientos = vista de control

## Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/app/login` | Inicio de sesión |
| `/app/dashboard` | KPIs operativos |
| `/app/clientes`, `/app/flota`, `/app/choferes` | Maestros CRUD |
| `/app/viajes` | Viajes (Operación / Gastos / Facturación) |
| `/app/proformas` | Proformas e ingresos |
| `/app/documentos` | Vencimientos (por vencer y vencidos) |
| `/app/configuracion/*` | Empresa, gastos, notificaciones |

## Migración legado

```bash
pnpm migrate:legacy -- --dry-run
pnpm migrate:legacy
```

Solo maestros, viajes, observaciones y PDFs (keys). Proformas y gastos históricos se cargan manualmente en RemitoListo.
