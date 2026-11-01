# Tesorería — flujo de fondos real

Módulo para superadmins que junta en un solo lugar la plata que **realmente** entra y sale:
Banco Macro, Banco Nación, ICBC, Mercado Pago y efectivo. Es la fuente de verdad de la caja, y está
separado de **Reportes → Caja**, que muestra lo facturado y cobrado según las facturas.

## Cómo se usa (flujo semanal)

1. **Importar.** Se pueden subir varios archivos juntos (por ejemplo Macro, Nación y Mercado Pago): hay una vista previa por archivo y se importan en orden.
   Macro y Nación: se descarga el extracto del home banking y se sube el `.xls` tal cual.
   Mercado Pago: se sube el PDF del **Resumen de cuenta**, que es el único formato que ofrece.
   ICBC: se sube el PDF del **extracto bancario** que manda el banco.
   - El banco se detecta por los encabezados del archivo (o por el texto del PDF).
   - Antes de guardar hay una vista previa que muestra:
     - cuántos movimientos son nuevos y cuántos ya estaban cargados,
     - cuántos se clasifican solos y cuántos quedan pendientes,
     - si el saldo del banco no encadena en algún punto,
     - si **falta un extracto**: el saldo con el que arranca el archivo no coincide con el último saldo cargado de esa cuenta (sólo cuando no se superponen),
     - si trae movimientos de un **mes cerrado**.
2. **Pendientes.** Se clasifica lo que el sistema no pudo deducir: una **categoría** y un **ámbito** (Empresa o Personal).
   - Al clasificar se puede "enseñar" al sistema de dos maneras: recordar el CUIT de la contraparte o crear una regla por texto.
   - En los dos casos, los demás pendientes que coinciden se clasifican solos.
   - En la misma pantalla aparecen las posibles **transferencias entre cuentas propias**: mismo monto, en otra cuenta, con ±2 días de diferencia. Se confirman con un clic.
3. **Cheques.** Cada cheque que se entrega se registra con número, monto, beneficiario, fecha de pago y categoría.
   - El banco sólo informa "CHEQUE P/CAMARA" o "CHEQUE CANJE INTERNO" y el número va en la referencia. Cuando llega el débito, se vincula solo con el cheque registrado (misma cuenta, mismo número, mismo monto) y se clasifica con sus datos.
   - Si el cheque se registra después de importar el débito, también se vincula al guardarlo.
   - Las multas por rechazo (que traen el número de cheque) lo marcan como **rechazado**.
   - Se ve cuánto hay en cheques emitidos que todavía no se debitaron (y cuánto vence en 7 días), y la lista de **débitos de cheques sin registrar**, con un botón para registrarlos.
   - Pestaña **Recibidos**: cheques de terceros (en cartera, depositado, descontado, endosado o rechazado). Al vincular un descuento con su crédito del banco ("CCERR OVER CASH"), queda el **costo del descuento**: valor de los cheques menos lo acreditado.
4. **Proyección.** Saldo de hoy, menos los cheques emitidos por debitar, más/menos los ingresos y gastos esperados (únicos, semanales o mensuales), semana por semana durante 8 semanas. Marca el punto más bajo y la primera semana en descubierto. Sugiere como mensuales las categorías que se repitieron en los últimos 3 meses.
5. **Cierres.** Por cuenta y por mes: movimientos, pendientes, saldo del sistema contra el del banco (o el último arqueo, para efectivo).
   - Cerrar guarda una foto. En un mes cerrado no se pueden cargar, borrar ni restaurar movimientos sin reabrirlo antes, y para reabrir hay que poner el motivo (queda en el historial y en Auditoría).
   - Si un extracto trae movimientos de un mes cerrado, la importación lo avisa y hay que confirmarlo a propósito. Queda registrado en Auditoría.
   - **Arqueo de efectivo:** se carga lo contado y se compara con el sistema. Opcionalmente se registra el ajuste en "Diferencias de caja".
6. **Movimientos.** Tabla con filtros y edición. Desde acá se carga a mano el **efectivo** y las transferencias entre cuentas.
7. **Resumen.** Muestra para el mes elegido:
   - ingresos, egresos, resultado y gastos personales, con un switch **Todo / Empresa / Personal**,
   - el saldo de cada cuenta según el sistema, comparado con el último saldo informado por el banco.

## Decisiones

- **Acceso:** sólo superadmin. Se controla con `requireSuperadmin()` en el código y con RLS `public.is_superadmin()` en la base. La ruta está en `SUPERADMIN_ONLY_ROUTES`.
- **Datos independientes:** las tablas `treasury_*` no referencian viajes, clientes, facturas ni combustible.
- **Infraestructura compartida:**
  - Papelera general (`/app/papelera`): soft delete con `deleted_at` y restauración con `restoreRecord`.
  - Auditoría general: `logAudit` con las acciones `treasury.*`.
- **Movimientos internos** (transferencias entre cuentas propias, extracciones de cajero): no suman como ingreso ni egreso.
  - La regla "Extracción cajero → Efectivo" crea automáticamente el espejo en la cuenta Efectivo.
- **Saldos:** el parser normaliza siempre al saldo **después** del movimiento. Nación informa el saldo anterior y Macro el posterior.
- **Deduplicación:** la clave se arma con `fecha | referencia | monto | descripción normalizada # n° de ocurrencia`. Así, reimportar el mismo extracto o uno superpuesto no duplica movimientos, y dos movimientos idénticos del mismo día no se pisan.
- **Clasificación:** primero se busca la contraparte por CUIT (con validación del dígito verificador). Si no hay, se aplican las reglas por prioridad ascendente; gana la primera que coincide.
  - Si la categoría tiene un ámbito por defecto, se usa ese.
  - Un movimiento sin categoría o sin ámbito queda **pendiente**.

## Estructura

| Ruta | Qué hay |
|---|---|
| `supabase/migrations/019_tesoreria.sql` | Tablas, RLS, seeds de cuentas, categorías y 21 reglas sacadas de los extractos de octubre 2026 |
| `supabase/migrations/020_tesoreria_mercadopago_rules.sql` | Reglas para Mercado Pago (se puede correr más de una vez) |
| `supabase/migrations/021_tesoreria_cheques.sql` | Registro de cheques emitidos |
| `supabase/migrations/022_tesoreria_control.sql` | Cierres mensuales, arqueos, proyección y cheques recibidos |
| `supabase/migrations/024_tesoreria_icbc.sql` | Cuenta ICBC y sus reglas (se puede correr más de una vez) |
| `lib/tesoreria/closing.ts` | Saldos a una fecha, filas de cierre, huecos entre extractos |
| `lib/tesoreria/forecast.ts` | Expansión de ítems recurrentes y proyección semanal |
| `lib/tesoreria/grouping.ts` | Agrupa comisión + IVA (sólo visual) |
| `lib/tesoreria/server/month-guard.ts` | Bloquea cambios de saldo en meses cerrados |
| `lib/tesoreria/cheques.ts` | Detección de débitos/rechazos de cheques, matching, estado y cheques por debitar |
| `lib/tesoreria/server/cheques-sync.ts` | Vincula cheques con débitos; se llama al guardar, importar, borrar y restaurar |
| `lib/tesoreria/mercadopago.ts` | Texto del PDF de Mercado Pago → celdas |
| `lib/tesoreria/icbc.ts` | Texto del PDF de ICBC → celdas (calcula el saldo de cada fila) |
| `lib/tesoreria/parsers.ts` | Detección del banco y parsers de Macro y Nación (celdas → `StatementRow`) |
| `lib/tesoreria/engine.ts` | Deduplicación, control de saldos, clasificación, sugerencia de patrones, pares internos |
| `lib/tesoreria/summary.ts` | Totales del resumen y saldos por cuenta |
| `lib/tesoreria/text.ts` | Montos y fechas es-AR, serial de Excel, CUIT |
| `lib/tesoreria/server/*` | Data layer, server actions y restauración desde la papelera |
| `components/tesoreria/*` | Vistas |
| `app/app/(authenticated)/tesoreria/*` | Páginas |
| `lib/tesoreria/__tests__` | Tests: `pnpm test:tesoreria` |

El `.xls` se lee **en el navegador** con SheetJS. El servidor recibe sólo las celdas y vuelve a
validar y clasificar todo antes de guardar.

El PDF de Mercado Pago se manda en base64 y se lee **en el servidor** con `unpdf`
(`lib/tesoreria/server/pdf.ts`). `lib/tesoreria/mercadopago.ts` convierte el texto en las mismas celdas que
daría una planilla, así que el resto del flujo (deduplicación por ID de operación, reglas, saldos) es el mismo.
Además, cruza los movimientos con el saldo inicial y final que trae el propio PDF. Límite: 700 KB por PDF
(un mes ocupa unos 65 KB).

El PDF de ICBC sigue el mismo camino (`isIcbcText` / `parseIcbcText`). El extracto sólo imprime el saldo en
algunas filas, así que el parser lo recalcula desde "SALDO ULTIMO EXTRACTO" y avisa si no coincide con un saldo
impreso o con el "SALDO FINAL" (señal de una fila mal leída). El año sale de "PERIODO dd-mm-aaaa AL ...".

## Puesta en marcha

1. `pnpm install`. Agrega SheetJS desde su CDN oficial; la versión de npm está desactualizada y tiene vulnerabilidades. **Hay que commitear el `pnpm-lock.yaml`**, porque Vercel instala con lockfile congelado.
2. Ejecutar `019_tesoreria.sql` en el SQL Editor de Supabase, o con `pnpm apply:migrations`.
3. Entrar como superadmin a **Tesorería → Configuración → Cuentas** y cargar el saldo inicial y la fecha de apertura de cada cuenta. Conviene usar el saldo del día anterior al primer movimiento importado.
4. Importar los extractos.

## Pendiente (próximas iteraciones)

- **Contrapartes por nombre en Mercado Pago:** el PDF no trae CUIT, así que hoy se aprende con reglas por texto.
- **Proyección por cobros de facturas:** hoy los cobros esperados se cargan a mano.
