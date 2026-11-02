# CRM de cotizaciones

Módulo para que **todo pedido de cotización** (web, WhatsApp, mail, teléfono) quede registrado,
asociado a una empresa normalizada, y se siga de punta a punta hasta ganarlo o perderlo.

- **Ruta:** `/app/crm` (sólo superadmin).
- **Migración:** `supabase/migrations/025_crm.sql` (correr **antes** de desplegar; se puede volver a correr).
- **Tests:** `pnpm test:crm` (normalización, matching, lectura de mensajes, precio, métricas).

## Flujo

```
Web (automático) ─┐
WhatsApp (pegar) ─┼─► Bandeja de entrada ──► Board ──► Ganada / Perdida
Mail (pegar)     ─┤    ¿qué empresa es?       Nuevo → Cotizando → Enviada → Negociación
Teléfono (anotar)─┘    (sugerencia + filtro)
```

1. **Bandeja de entrada** (`/app/crm/bandeja`). Cada pedido llega con lo que se pudo leer del texto
   (empresa, contacto, mail, teléfono, CUIT, origen, destino, pallets, servicio, fecha, frecuencia).
   El sistema sugiere a qué empresa corresponde, con porcentaje y motivo:
   - CUIT igual · alias conocido · mismo nombre · dominio del mail (`@lenovo.com`) · mail o teléfono de un contacto · **nombre parecido** (“Lenevo” ≈ Lenovo, 85%).
   - ≥ 90% se preselecciona; por debajo hay que confirmar a mano. Si no hay candidatos, propone “Empresa nueva”.
   - Si el cliente escribió distinto (“Lenevo”), se guarda como **alias** y la próxima vez matchea solo.
   - Se puede descartar (no es cotización, duplicado, spam) y recuperar después.
2. **Board** (`/app/crm`). Arrastrar tarjetas entre etapas (o menú “Mover a” en el celular).
   - Para pasar a Enviada/Negociación/Ganada pide el precio; para Perdida pide el motivo.
   - Alertas en la tarjeta: **Sin responder** (no se respondió en el día o ya son las 21 h), seguimiento vencido, validez vencida.
3. **Cotización** (`/app/crm/cotizaciones/[id]`). Datos del pedido, precio con **sugerencia del tarifario**,
   texto de la cotización listo para mandar por **WhatsApp** (abre wa.me), **mail** (mailto) o copiar.
   Al enviar pasa sola a “Enviada” y se registra la hora (tiempo de respuesta). Historial con notas.
4. **Empresas** (`/app/crm/empresas`). Cuántas veces consultó cada una, qué pide, cuánto se ganó.
   Detecta **posibles duplicados** y permite **fusionar** (mueve todo y deja el nombre viejo como alias).
5. **Métricas** (`/app/crm/metricas`). Pedidos por canal, empresas nuevas vs. recurrentes, servicio y destinos
   pedidos, conversión, % respondidas en el día, mediana de respuesta, motivos de pérdida, top empresas.
6. **Tarifario** (`/app/crm/tarifario`). Precio por pallet y por semi completo a cada provincia (origen BA),
   y recargo % para congelado. Sólo sugiere; el precio final siempre se edita.

## Entrada desde la landing

Endpoint público: `POST /api/crm/inbound` (JSON o form-data).

Variables de entorno (Vercel):

| Variable | Uso |
|---|---|
| `CRM_ALLOWED_ORIGINS` | Dominios de la landing que pueden enviar, separados por coma (ej. `https://www.transporterosarioperez.com.ar`) |
| `CRM_INBOUND_SECRET` | Token para integraciones servidor a servidor (opcional) |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya existe; el endpoint inserta con service role |

Campos (todos opcionales, pero al menos uno de mensaje/empresa/mail/teléfono):
`name, company, email, phone, cuit, message, origin, destination, serviceType (congelado|refrigerado|controlada|seco),
loadType (completa|parcial), pallets, weightKg, loadDate (AAAA-MM-DD), frequency (unica|semanal|quincenal|mensual), utm{}`.
`website` es un honeypot: si viene con algo, se responde OK y no se guarda.

Ejemplo para el cotizador web (antes de abrir WhatsApp):

```js
await fetch('https://<plataforma>/api/crm/inbound', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name, company, email, phone,
    origin, destination, serviceType, pallets, loadDate,
    message, // el mismo texto que se manda al WhatsApp
    website: honeypotValue,
    utm: Object.fromEntries(new URLSearchParams(location.search)),
  }),
}).catch(() => {}) // si falla, igual se abre WhatsApp
window.open(`https://wa.me/5493329643639?text=${encodeURIComponent(message)}`)
```

Protecciones: origen permitido (CORS), límite de 8 envíos cada 10 min por IP, y si el mismo mail/teléfono
manda el mismo mensaje en 10 minutos se toma como doble envío. Si después el mismo pedido se pega
desde WhatsApp, la bandeja lo marca como **posible duplicado**.

### Integraciones (fase 2)

Con `Authorization: Bearer <CRM_INBOUND_SECRET>` el endpoint acepta `channel` (`email`, `whatsapp`…) y
`externalId` (id del mensaje; evita duplicados si el webhook reintenta). Sirve para:
- **Mail:** una regla de reenvío de la casilla a Make/Zapier/Resend Inbound que haga el POST con `subject` y `message`.
- **WhatsApp:** si el número pasa a WhatsApp Cloud API o Twilio (ya hay credenciales para alertas), el webhook de mensajes entrantes hace el POST.

## Datos

Tablas `crm_*`, independientes del resto (no se cruzan con Clientes de facturación):
`crm_companies` (con `name_norm`), `crm_company_aliases`, `crm_contacts` (con `phone_norm`),
`crm_inbound_requests` (bandeja; `parsed` jsonb), `crm_quotes` (board; `number` → COT-0001),
`crm_quote_events` (historial), `crm_rates` (tarifario).

- Papelera: cotizaciones y empresas (las fusionadas no se recuperan).
- Auditoría: pase al board, descarte, ganada/perdida, borrados, fusiones, tarifas.
- La lógica pura está en `lib/crm/*.ts`; servidor en `lib/crm/server/*`; UI en `components/crm/*`.
