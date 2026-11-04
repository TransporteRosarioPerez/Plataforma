# Proformas y facturas desde PDF

## Importar el PDF completo (recomendado)

En **Proformas → Importar PDF** se sube el PDF entero de Grupo Arcor (todas las hojas, sin cortar):

1. Se detectan todas sus proformas, una por compañía + jurisdicción (183853-01-02, 183853-01-03, 183853-33-02…), con sus hojas.
2. Cada una muestra su estado:
   - **Para revisar**: todos los viajes existen, el cliente se encontró por CUIT y cada corte cierra con su TOTALES.
   - **Con problemas**: viaje que no existe en la plataforma, cliente sin CUIT cargado, PDF que no cierra, etc. No se puede guardar.
   - **Ya cargada**: ese número ya existe; se saltea (se puede reimportar el mismo PDF sin duplicar).
3. Al abrir cada una se ven viajes, cortes y totales, y la columna **Esperado** (precio unitario × pallets del viaje). Si el PDF difiere de lo esperado se avisa en amarillo; no bloquea porque el PDF manda.
4. Se tilda "Revisé…" en cada una y **Guardar N revisadas** las guarda de a una, por el mismo `createProforma` de siempre (mismas validaciones y Auditoría).
5. Cada proforma guarda **sólo sus hojas** del PDF (`183853-01-02 (hojas 1-9).pdf`), cortadas en el navegador con `pdf-lib`.

Un viaje que aparece en dos proformas del mismo PDF (Arcor y Bagley) entra como compartido.

## Proforma de a una (Nueva proforma)

1. En **Proformas → Nueva proforma** se sube el PDF "Resumen de viajes proformados".
2. El PDF se lee en el navegador (si falla, en el servidor, hasta ~700 KB) y se arma solo:
   - número `NRO PROFORMA-COMPAÑÍA-JURISDICCIÓN` (ej. `183853-01-02`),
   - cliente por CUIT, fecha de la hoja,
   - un viaje por fila, buscado por **número de carga = `trips.code`**, con el importe total de la fila.
   Si el PDF trae varias compañías o jurisdicciones, se elige cuál cargar.
3. Cada viaje entra como:
   - **libre**: línea normal;
   - **compartido**: ya está en una proforma de otra compañía (Arcor + Bagley);
   - **ajuste**: ya facturado para la misma compañía (otra proforma o sistema anterior).
4. En el paso **Viajes** aparece el control contra el PDF. Para guardar tiene que:
   - existir cada viaje del PDF y tener el mismo importe al centavo,
   - no haber viajes de más,
   - cerrar el total de cada corte contra su línea TOTALES,
   - estar tildado "Revisé que los viajes y el total coinciden con el PDF".
5. El servidor vuelve a validar que el total sea el del PDF y que el número no haya cambiado.
   En Auditoría queda `checkedAgainstPdf` y `pdfTotal`.

Sin PDF (u otro formato) la proforma se sigue cargando a mano como antes.

## Factura (ARCA)

- Al subir el PDF de la factura se leen número (`00002-00000250`), tipo (por el código de comprobante), fecha, neto, IVA y total, y se elige sola la proforma con el mismo neto.
- **Se guardan el IVA y el total impresos por ARCA.** ARCA redondea el IVA línea por línea, así que puede diferir en centavos de `neto × 21%` (caso real: 24.407.644,70 vs 24.407.644,71).
- No deja guardar si el neto de la factura no es el de la proforma al centavo, si el IVA se aleja del 21% más de 1 centavo por línea, o si el PDF es una nota de crédito/débito.
- Sin PDF, el IVA se estima sobre el neto como antes.
- Al editar una proforma ya facturada, el IVA de la factura sólo se recalcula si cambió el neto.

## Código

| Qué | Dónde |
|---|---|
| Renglones de un PDF (unpdf) | `lib/pdf/text-lines.ts`, `lib/pdf/read-pdf-lines.ts` |
| Lectura proforma Arcor | `lib/proformas/parse-arcor-pdf.ts` |
| Control PDF vs proforma | `lib/proformas/pdf-review.ts`, `components/proformas/proforma-pdf-check.tsx` |
| Match de viajes | `lib/actions/proforma-pdf.ts` |
| Importar PDF completo | `components/proformas/import-proformas-pdf-sheet.tsx`, `lib/proformas/pdf-import.ts` |
| Cortar hojas del PDF | `lib/pdf/split-pages.ts` (dependencia `pdf-lib`) |
| Lectura factura ARCA | `lib/invoices/parse-arca-pdf.ts` |

Tests: `pnpm test:facturacion` (datos ficticios con la estructura real).
