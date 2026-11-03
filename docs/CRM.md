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

## Prospección: cargas de vuelta (`/app/crm/prospectos`)

Para no volver vacío: base de empresas que mandan carga **hacia Buenos Aires** (fruta del Alto Valle,
cítricos y arándanos de Tucumán, etc.) y una secuencia de mails que sale desde la casilla de Gmail de la empresa.

- **Migración:** `supabase/migrations/026_crm_prospectos.sql` (después de la 025; se puede volver a correr).
- **Tests:** `pnpm test:crm` (incluye `prospecting.test.ts`).
- **Primera tanda:** `docs/prospectos/carga-retorno-tanda-1.csv` (35 empresas, fuentes en cada fila) → botón **Importar CSV**.

### Flujo

```
Importar CSV / cargar a mano ──► Prospectos ──► seleccionar ──► "Enviar mail de vuelta" (vista previa + confirmar)
                                                                     │
                     job (cron 10 h lun–vie + "Sincronizar ahora")    ▼
   ┌───────────────── envía hasta N por día desde Gmail (mail 1, después seguimientos día 4, 10 y 18 en el mismo hilo)
   └───────────────── lee los hilos:
                        respuesta      → pedido en la Bandeja de entrada (canal mail) y se corta la secuencia
                        "no" / baja    → lista de bajas, nunca más se le escribe
                        rebote         → rebotado + lista de bajas
                        respuesta automática (vacaciones) → se ignora
```

- **Plantillas** (`/app/crm/prospectos/plantillas`): 4 mails editables con vista previa. Variables `{saludo} {empresa}
  {provincia} {localidad} {productos} {dia_vuelta} {gancho} {firma}`; lo que va entre `[[ ]]` se omite si falta un dato.
- **Rutas de vuelta**: Alto Valle, NOA, Litoral, Cuyo… con el día de vuelta (“los jueves”) que se usa en los mails.
  Al importar, la ruta se deduce de la columna `ruta` o de la provincia.
- **Gancho**: una línea personalizada por empresa para el primer mail. Es lo que más sube las respuestas.
- **Anti-spam**: tope diario (default 25), sólo en horario hábil, texto plano, `List-Unsubscribe` one-click
  (`/api/crm/unsubscribe`, pide confirmación en el navegador), lista de bajas global (`crm_email_suppressions`).
- **Estados del prospecto**: Sin contactar → En secuencia → Respondió / Sin respuesta / Pidió baja / Rebotó.
  Cotizando, Ganado y Perdido se marcan a mano (y cortan la secuencia).

### Configuración (una vez)

1. **Google Cloud** (con la cuenta de Workspace de la empresa): crear proyecto → habilitar **Gmail API** →
   **Pantalla de consentimiento OAuth** tipo **Interno** (así no hace falta verificación de Google) →
   **Credenciales → ID de cliente OAuth → Aplicación web**, con URI de redirección
   `https://<plataforma>/api/crm/gmail/callback` (y `http://localhost:3000/api/crm/gmail/callback` para probar).
2. **Vercel** → variables `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CRM_GMAIL_TOKEN_KEY`
   (`openssl rand -hex 32`; si se cambia, hay que volver a conectar Gmail) y `CRM_PUBLIC_URL`. `CRON_SECRET` ya existe.
3. Correr la migración 026, desplegar y en **CRM → Prospectos → Conectar Gmail** autorizar la casilla
   (permisos: enviar y leer). La casilla tiene que tener SPF, DKIM y DMARC configurados (Google Workspace → Autenticar correo).
4. Completar el día de vuelta de cada ruta en **Plantillas** y revisar los textos.

### Job

`GET /api/cron/crm-outreach` (Bearer `CRON_SECRET`), en `vercel.json` a las 13:00 UTC (10 h Argentina) de lunes a viernes.
En el plan Hobby de Vercel los cron corren una vez por día; con Pro conviene `*/30 12-21 * * 1-5` para leer respuestas
cada media hora. Mientras tanto, **Sincronizar ahora** hace lo mismo a mano.

Tablas: `crm_prospects`, `crm_outreach_routes`, `crm_outreach_templates`, `crm_outreach` (una secuencia por prospecto;
guarda el hilo de Gmail), `crm_outreach_messages`, `crm_email_suppressions`, `crm_gmail_connection` (fila única;
refresh token cifrado con AES-256-GCM; sin políticas RLS, sólo service role).
