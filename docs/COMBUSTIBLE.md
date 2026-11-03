# Combustible

Ruta: `/app/combustible`. Reemplaza la importación de Edenred / YPF / Shell por **carga manual** desde la planilla.

## Carga
Cada renglón de la planilla es una carga en `fuel_transactions` con `provider = 'manual'`:

| Campo | Notas |
|---|---|
| Patente | Selector de Vehículos (agrupado en Camiones y Semis / térmicos). Obligatorio. Los inactivos no aparecen salvo que la carga ya los tenga. |
| Chofer | Selector de Choferes. Opcional. |
| Fecha | Se guarda a las 12:00 hora Argentina. |
| Litros | Obligatorio. |
| Total pagado | Opcional. Vacío/0 = **precio pendiente**. El precio por litro se calcula (`total / litros`). |
| Km odómetro | Opcional. Con ≥ 2 lecturas en el período calcula L/100 km. |
| Forma de pago | Cuenta corriente / contado / tarjeta / otro. Base para conciliar con el extracto. |

"Guardar y cargar otra" deja abierta la carga manteniendo fecha, chofer y forma de pago.

La carga se vincula sola al viaje del camión (o del semi) en esa fecha y suma al costo del viaje. Si se vincula a mano, editar la carga no la desvincula.

## Reporte
Período: un mes, últimos 3 / 6 / 12 meses (hasta el mes actual) o todo el historial. Los recuadros comparan contra el período anterior de la misma duración.

| Pestaña | Qué muestra |
|---|---|
| Evolución | 12 meses: pesos pagados por mes (barras) y precio promedio por litro (línea). Un gráfico por medida. |
| Camiones | Por camión: cargas, litros, $, % del gasto de camiones, $/L, sin precio, L/100 km si hay odómetro. |
| Semis / térmicos | Lo mismo para las patentes de semis (equipo de frío). |
| Choferes | Por chofer, sumando camión y térmico: unidades usadas, litros, litros por carga, $, % del gasto, $/L. |
| Viajes | Cargas vinculadas a cada viaje: litros, $, km del viaje, L/100 km y $ por km (aproximado: depende de que estén todas las cargas). |
| Cargas | El listado para buscar y corregir. |

Cálculos en `lib/fuel/report.ts`, resolución de patente/chofer en `lib/fuel/resolve.ts`. Tests: `pnpm test:combustible`.

## Migración
`023_fuel_manual_loads.sql` (idempotente). Correrla **antes** de desplegar.

## Pendiente: conciliación con el extracto
Ver decisiones en el proyecto. Un pago de cuenta corriente en el banco cubre muchas cargas, y un mes de cargas puede pagarse en varias transferencias: la relación es N a N, se agrupa por proveedor y período.
