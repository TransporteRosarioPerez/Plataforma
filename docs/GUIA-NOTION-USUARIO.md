# Cómo usar Transporte Rosario Perez

> **Para quién es esta guía:** operaciones, administración y contabilidad. Sin tecnicismos.
>
> **Última actualización:** junio 2026

---

## 💡 En 30 segundos

El sistema ayuda a hacer **cuatro cosas**:

1. **Registrar viajes** (quién fue, con qué camión, a dónde)
2. **Controlar gastos y ganancia** de cada viaje
3. **Cobrar al cliente** (proformas y seguimiento de pago)
4. **No olvidar vencimientos** (VTV, licencias, seguros…)

**Orden ideal:**

```
Cargar datos base → Crear viaje → Gastos + PDF → Cobrar → Proforma → Cobrada
```

En paralelo, siempre revisar la **campanita** 🔔 de vencimientos.

---

## 🗂️ Cómo armar esto en Notion (recomendado)

### Estructura de páginas

```
📘 Manual Transporte Rosario Perez          ← página principal (esta guía)
├── 📋 Checklist: primer día
├── 🚛 Flujo del viaje
├── 💰 Cobranza y proformas
├── 📄 Vencimientos y alertas
└── ❓ Preguntas frecuentes
```

### Bloques que conviene usar

| En Notion escribí | Para qué sirve |
|-------------------|----------------|
| `/callout` 💡 | Resúmenes y reglas importantes |
| `/toggle` | Detalle opcional (“¿Qué significa cada estado?”) |
| `/to-do` | Checklists diarios y de arranque |
| `/table` | Comparar conceptos (ej. dos tipos de cliente) |
| `/divider` | Separar secciones grandes |
| `/column` | Poner “Operaciones” y “Administración” lado a lado |

### Tips para que lo entienda cualquiera

- **Una idea por bloque** — párrafos cortos
- **Títulos con verbos** — “Crear un viaje”, no “Viajes”
- **Evitar siglas** sin explicar (VTV, LINTI, etc.)
- **Sin diagramas Mermaid** — Notion no los muestra bien; usá flechas de texto o imágenes simples
- **Agregar capturas de pantalla** después de cada paso clave (opcional pero muy útil)

### Importar el contenido

1. Creá una página nueva en Notion
2. Menú `⋯` → **Import** → **Markdown**
3. Elegí este archivo: `docs/GUIA-NOTION-USUARIO.md`
4. Revisá que los callouts (`>`) se hayan convertido bien; si no, convertilos a `/callout` manualmente
5. Agregá capturas donde diga `[CAPTURA: ...]`

---

## 📋 Checklist: primer día (antes de operar)

Marcá cada ítem cuando esté listo:

- [ ] Camiones y semis cargados en **Flota** (estado: activo)
- [ ] Choferes cargados en **Choferes** (estado: activo)
- [ ] Clientes cargados en **Clientes**
- [ ] Datos de la empresa en **Configuración → Empresa**
- [ ] Documentos con fecha de vencimiento en flota, choferes y empresa
- [ ] Alertas configuradas en **Configuración → Notificaciones** (si usan WhatsApp)
- [ ] Probado el login de cada usuario

> 💡 **Regla:** si falta camión, semi, chofer o cliente, el botón **Nuevo viaje** no se habilita.

---

## 🧩 Las 4 áreas del sistema

| Área | Menú | Qué hacés acá |
|------|------|----------------|
| **Datos base** | Flota, Choferes, Clientes, Configuración | Cargar una vez y mantener actualizado |
| **Operación** | Viajes | El trabajo del día a día |
| **Cobranza** | Viaje → Facturación, Proformas | Pasar de “viaje hecho” a “plata cobrada” |
| **Cumplimiento** | Vencimientos, campanita 🔔 | Renovar documentos antes de que venzan |

---

## 🚛 Flujo del viaje (paso a paso)

### Vista rápida

```
1. Crear viaje
      ↓
2. Cargar gastos (durante y después del viaje)
      ↓
3. Actualizar estado (En curso → Entregado → Enviado)
      ↓
4. Subir PDF del legajo
      ↓
5. Cargar cuánto se cobra (Facturación)
      ↓
6. Marcar "Pendiente de pago"
      ↓
7. Incluir en una Proforma
      ↓
8. Cuando el cliente paga → Proforma "Cobrada" → Viaje "Pagado"
```

---

### Paso 1 — Crear el viaje

**Dónde:** Viajes → **Nuevo viaje**

**Completar:**
- Cliente del viaje
- Camión, semi y chofer
- Origen y destino
- Tipo de carga y fechas

**Estado inicial sugerido:** *Incompleto* o *En curso*

`[CAPTURA: pantalla Nuevo viaje]`

---

### Paso 2 — Cargar gastos

**Dónde:** Abrir el viaje → pestaña **Gastos**

**Qué cargar:** peajes, combustible, viáticos, anticipos al chofer, etc.

> 💡 El sistema **suma solo** todos los gastos. No hace falta calcular el total a mano.

**Cuándo:** durante el viaje y al cerrarlo (revisar que no falte nada).

---

### Paso 3 — Actualizar el estado operativo

**Dónde:** Encabezado del viaje (selector de estado)

| Estado | Cuándo usarlo |
|--------|---------------|
| Incompleto | Recién creado o faltan datos |
| En curso | El camión está en ruta |
| Entregado | La carga ya se entregó |
| Pendiente Wirtrack | Falta cerrar algo en el sistema del cliente |
| Enviado | Documentación enviada al cliente |

> ⚠️ **Importante:** los estados de cobro (*Pendiente de pago* y *Pagado*) **no** se cambian desde acá. Van por Facturación y Proformas.

---

### Paso 4 — Subir el PDF del viaje

**Dónde:** Viaje → pestaña **Operación** → sección **PDF del viaje**

**Qué es:** el legajo consolidado del viaje (como se hacía antes).

**Cuándo subirlo:** cuando el viaje esté cerrado operativamente (Entregado / Enviado).

**Tips:**
- Se puede **reemplazar** si subieron el archivo equivocado
- En el listado de viajes, el ícono 📄 indica que tiene PDF

`[CAPTURA: subir PDF]`

---

### Paso 5 y 6 — Facturación del viaje

**Dónde:** Viaje → pestaña **Facturación**

1. Cargar el **importe a cobrar**
2. Ver si el viaje **rinde o pierde** (el sistema resta los gastos)
3. Clic en **Marcar pendiente de pago**

> 💡 Hasta que no carguen el importe a cobrar, el resultado del viaje puede decir **“Sin ingreso”** aunque ya tengan gastos.

---

## 💰 Cobranza y proformas

### ¿Qué es una proforma?

Es el **pedido de pago al cliente**: agrupa uno o varios viajes que ya están listos para cobrar.

### ¿Cuándo crearla?

**Solo después** de que el viaje esté en **Pendiente de pago**.

```
Viaje terminado → Importe cargado → Pendiente de pago → AHORA sí → Proforma
```

### Cómo crear una proforma

**Dónde:** Proformas → **Nueva proforma**

1. Elegir el **cliente** (a quién le facturan)
2. Seleccionar los **viajes pendientes de pago**
3. Cargar importe e impuestos por cada viaje
4. Guardar

### Estados de la proforma

| Estado | Qué significa | Qué pasa con los viajes |
|--------|---------------|-------------------------|
| Pendiente | Esperando facturación / pago | Siguen pendientes de pago |
| Facturada | Ya se facturó al cliente | Siguen pendientes de pago |
| **Cobrada** | **El cliente pagó** | **Todos los viajes pasan a Pagado** ✅ |

> 💡 **El cobro se registra marcando la proforma como Cobrada.** No se marca el viaje como Pagado a mano.

`[CAPTURA: crear proforma]`

---

## 📊 Cómo se calcula si el viaje rinde

Fórmula simple:

```
Resultado = Lo que cobrás − Lo que gastaste
```

| Situación | Qué muestra el sistema |
|-----------|------------------------|
| No hay gastos ni ingreso cargado | Sin datos |
| Hay gastos pero no importe a cobrar | Sin ingreso |
| Cobrás más de lo que gastaste | Ganancia ✅ |
| Gastaste más de lo que cobrás | Pérdida ❌ |
| Empatan | Equilibrio |

---

## 📄 Vencimientos y alertas

### ¿Qué documentos alertan?

Solo los que tienen:
- Fecha de vencimiento cargada
- Tipo **recurrente** (no “único”)
- Están en la ficha de **flota**, **chofer** o **empresa**

Ejemplos: VTV, licencia, seguro, LINTI.

### ¿Cuándo avisa?

| Días restantes | Estado | Dónde lo ves |
|----------------|--------|--------------|
| Más de 7 días* | Vigente | — |
| 7 días o menos* | Por vencer | Campanita 🔔 + Vencimientos |
| 0 (hoy) | Vence hoy | Campanita + Vencimientos |
| Ya pasó | Vencido | Campanita + Vencimientos |

\* *7 días es el valor por defecto. Se configura en Configuración → Notificaciones.*

### WhatsApp vs campanita

| | Campanita (en la app) | WhatsApp |
|--|----------------------|----------|
| Muestra vencidos | Sí | No |
| Avisa antes de vencer | Sí | Sí |
| Cuándo | Siempre que entrás | Una vez al día (~8:00) |

### Cómo renovar un documento

1. Ir a **Vencimientos** (o a la ficha del camión/chofer)
2. Clic en **Renovar**
3. Cargar nueva fecha y archivo (si hay)
4. Listo — el anterior queda en el historial

---

## 📅 Rutina recomendada

### Todos los días (operaciones)

- [ ] Revisar campanita 🔔 de vencimientos
- [ ] Crear o actualizar viajes del día
- [ ] Cargar gastos
- [ ] Subir PDFs de viajes cerrados
- [ ] Actualizar estados (Entregado, Enviado…)

### Una vez por semana (administración)

- [ ] Cargar importes a cobrar en viajes cerrados
- [ ] Pasar viajes a **Pendiente de pago**
- [ ] Armar **proformas** por cliente
- [ ] Renovar documentos por vencer
- [ ] Revisar **Dashboard** y **Reportes**

### Cuando entra un pago (contabilidad)

- [ ] Confirmar el pago del cliente
- [ ] Marcar proforma como **Cobrada**
- [ ] Verificar que los viajes quedaron en **Pagado**

---

## 👥 Quién hace qué

| Persona / área | Pantallas que usa | Tareas principales |
|----------------|-------------------|-------------------|
| **Operaciones** | Viajes, Flota, Choferes, Vencimientos | Crear viajes, gastos, PDFs, estados |
| **Administración** | Viajes, Proformas, Clientes, Reportes | Cerrar viajes, proformas, revisar márgenes |
| **Contabilidad** | Proformas, Reportes | Cobranza, marcar proformas cobradas |
| **Dueño / admin** | Configuración, todo lo anterior | Empresa, alertas, usuarios |

---

## ❓ Preguntas frecuentes

> Usá cada pregunta como un **Toggle** en Notion para que la página no quede larga.

### No me deja crear un viaje

Falta alguno de estos datos: cliente, camión activo, semi activo, chofer activo. Revisá Flota, Choferes y Clientes.

### El viaje no aparece al crear una proforma

El viaje tiene que estar en **Pendiente de pago**. Andá a Viaje → Facturación → **Marcar pendiente de pago**.

### Ya está en otra proforma y no puedo agregarlo

Un viaje solo puede estar en **una proforma activa** a la vez. Cobrá o cerrá la proforma anterior.

### No puedo cambiar el estado del viaje

Si ya está en **Pendiente de pago** o **Pagado**, el estado se maneja desde Facturación y Proformas.

### El viaje dice "Sin ingreso" pero tiene gastos

Falta cargar el **importe a cobrar** en la pestaña Facturación.

### Un documento no aparece en las alertas

Probablemente está marcado como **Único** (sin vencimiento recurrente) o no tiene fecha de vencimiento.

### ¿Dónde subo el PDF del viaje?

En el viaje → pestaña **Operación** → **Subir PDF**. No es lo mismo que los documentos de VTV/licencia en Flota o Choferes.

### ¿Cuándo el viaje pasa a Pagado?

Automáticamente cuando la proforma que lo incluye se marca como **Cobrada**.

---

## 🔗 Documentación técnica (para el equipo de sistemas)

| Documento | Contenido |
|-----------|-----------|
| Guía técnica completa | `docs/GUIA-FLUJOS-OPERATIVOS.md` |
| Checklist de producción | `docs/CHECKLIST-PRODUCCION.md` |

---

## ✅ Resumen final

> **Maestros → Viaje → Gastos + PDF → Facturación → Proforma → Cobrada**
>
> Y en paralelo: **revisar vencimientos** para no operar con documentación vencida.
