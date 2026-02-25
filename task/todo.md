# Plan de Mejoras v3 - Simulador de Vaciado de Tanques

**Fecha:** 2026-02-25
**Autor:** Claude (Assistant)

---

## Resumen Ejecutivo

7 mejoras organizadas en 4 fases de implementación. Prioridad: primero las correcciones de cálculo (fase 1), luego mejoras de catálogo y parámetros (fase 2), después cambios de presentación visual (fase 3), y finalmente el reporte PDF (fase 4).

---

## Fase 1: Corrección del Solver (Bug Crítico)

### Tarea 1.1 — Incluir pérdidas de descarga en `_solve_flow()` (Mejora 1)

**Archivo:** `app/utils/simulation.py` — función `_solve_flow()` (línea 217)

**Problema:** La función `system_head(q_m3h)` dentro del solver solo calcula pérdidas de succión (tubería + accesorios + válvula). Las pérdidas de descarga (fricción en tubería + accesorios de descarga) no se incluyen. Esto hace que el punto de operación calculado tenga un caudal mayor al real, porque el sistema "parece" más fácil de lo que es.

**Cambio concreto:**
- Dentro de `system_head(q_m3h)` (línea 239), agregar el cálculo de pérdidas de descarga:
  - Calcular velocidad en tubería de descarga usando `self.discharge['id']`
  - Calcular Reynolds y factor de fricción para descarga
  - Calcular `h_loss_pipe_discharge` + `h_loss_fittings_discharge`
  - Sumar al retorno: `return h_pipe + h_fittings + h_discharge_total + head_required_system`
- Proteger con `if self.discharge:` para no romper si no hay datos de descarga

**Líneas afectadas:** ~10 líneas nuevas dentro de `system_head()` (líneas 239-260)

- [ ] **1.1** Agregar pérdidas de descarga dentro de `system_head()` en `_solve_flow()`

---

### Tarea 1.2 — Extender rango de búsqueda del solver más allá de `flow_points[-1]` (Mejora 1)

**Archivo:** `app/utils/simulation.py` — función `_solve_flow()` (línea 232)

**Problema:** `q_max = float(pump.flow_points[-1])` limita la búsqueda al último punto definido de la curva. Si en ese punto `H_pump(Q_max) > H_system(Q_max)`, el solver retorna `q_max` sin encontrar la intersección real. La clase `PumpCurve.get_head()` ya soporta extrapolación (decrementa linealmente más allá del último punto), pero el solver no la aprovecha.

**Cambio concreto:**
- Cambiar `q_max = float(pump.flow_points[-1])` por `q_max = float(pump.flow_points[-1]) * 1.5`
- Esto permite explorar un 50% más allá del último punto de la curva
- La extrapolación de `PumpCurve.get_head()` ya está implementada y retornará valores decrecientes (eventualmente 0), garantizando que se encuentre la intersección

**Líneas afectadas:** 1 línea modificada (línea 232)

- [ ] **1.2** Extender `q_max` a `flow_points[-1] * 1.5` en `_solve_flow()`

---

## Fase 2: Parámetros de Simulación

### Tarea 2.1 — Selector de margen NPSH en frontend (Mejora 2)

**Archivo:** `app/templates/index.html`

**Cambio:** Agregar un `<select id="npsh_margin">` en la sección de Bomba (después de `pump_type`, línea ~388), con 3 opciones:
- `1.1` — Margen mínimo (servicios no críticos)
- `1.15` — Margen moderado (servicios generales)
- `1.2` — Margen estándar API 610 (selected por defecto)

**Líneas afectadas:** ~8 líneas nuevas en `index.html`

- [ ] **2.1** Agregar selector `npsh_margin` en HTML

### Tarea 2.2 — Enviar `npsh_margin` al backend

**Archivo:** `app/static/js/main.js` — función que construye el payload del POST `/simulate`

**Cambio:** Leer `document.getElementById('npsh_margin').value` y agregarlo al objeto JSON enviado al backend como `npsh_margin`.

**Líneas afectadas:** 1 línea nueva en el payload

- [ ] **2.2** Enviar `npsh_margin` en el payload de simulación

### Tarea 2.3 — Usar `npsh_margin` en `simulation.py`

**Archivo:** `app/utils/simulation.py`

**Cambios:**
1. En `__init__()`: recibir parámetro `npsh_margin=1.2` y guardarlo como `self.npsh_margin`
2. En `step()` (línea 170): cambiar `1.2 * npsh_r` por `self.npsh_margin * npsh_r`

**Archivo:** `main.py`
1. Leer `npsh_margin = float(data.get('npsh_margin', 1.2))`
2. Pasarlo al constructor de `Simulation(... npsh_margin=npsh_margin)`

**Líneas afectadas:** ~5 líneas entre ambos archivos

- [ ] **2.3** Usar `npsh_margin` dinámico en backend (simulation.py + main.py)

---

### Tarea 2.4 — Catálogo ampliado de accesorios K (Mejora 4)

**Archivo:** `app/utils/valves_db.py` — diccionario `FITTINGS` (línea 61)

**Cambio:** Reemplazar el diccionario `FITTINGS` actual por uno ampliado basado en Crane TP-410. Agregar tabla `FT_BY_DIAMETER` para factor de fricción turbulento por diámetro. Agregar función `get_fitting_k(fitting_type, pipe_diameter_inches)` que calcule K usando `f_T × (Le/D)` cuando corresponda.

Nuevos accesorios:
| Accesorio | Valor K |
|---|---|
| `ENTRADA_BORDA_ENTRANTE` | 0.78 |
| `ENTRADA_BORDA_PLANA` | 0.50 |
| `ENTRADA_REDONDEADA` | 0.04 |
| `CODO_90_RL` | 20 × f_T |
| `CODO_90_RC` | 30 × f_T |
| `CODO_45` | 16 × f_T |
| `TEE_DIRECTO` | 20 × f_T |
| `TEE_RAMAL` | 60 × f_T |
| `CHECK_SWING` | 100 × f_T |
| `CHECK_LIFT` | 600 × f_T |
| `REDUCCION_CONCENTRICA` | 0.5 |
| `REDUCCION_EXCENTRICA` | 0.5 |
| `AMPLIACION_GRADUAL` | 0.2 |
| `FILTRO_Y` | 2.0 |
| `SALIDA_TUBERIA` | 1.0 |

**Líneas afectadas:** ~40 líneas reemplazadas/nuevas en `valves_db.py`

- [ ] **2.4** Ampliar catálogo FITTINGS en `valves_db.py` con Crane TP-410

### Tarea 2.5 — Accesorios seleccionables en HTML (succión y descarga)

**Archivo:** `app/templates/index.html`

**Cambio:**
- **Succión:** Reemplazar los checkboxes actuales (líneas ~295-355) por selectores con tipo de accesorio y cantidad, usando los nuevos nombres del catálogo. Incluir selector de tipo de entrada al tanque (borda entrante / plana / redondeada).
- **Descarga:** Ampliar la sección de descarga (línea ~450) para incluir los mismos accesorios disponibles con cantidad configurable. Agregar tipo de check valve (swing / lift) y salida de tubería.

**Líneas afectadas:** ~40 líneas modificadas en sección succión, ~30 líneas nuevas en sección descarga

- [ ] **2.5** Actualizar selectores de accesorios en HTML (succión + descarga)

### Tarea 2.6 — Conectar nuevos accesorios al cálculo de K en `main.py`

**Archivo:** `main.py`

**Cambio:** Actualizar el bloque que calcula `k_fittings` (líneas 160-170) y `k_discharge_fittings` (líneas 187-191) para leer los nuevos accesorios del request y usar la función `get_fitting_k()` de `valves_db.py` con el diámetro de tubería correspondiente.

**Líneas afectadas:** ~20 líneas modificadas

- [ ] **2.6** Actualizar cálculo de K en `main.py` usando nuevo catálogo

---

## Fase 3: Presentación y Visualización

### Tarea 3.1 — Convertir tiempo de segundos a minutos (Mejora 3)

**Archivo:** `app/static/js/main.js`

**Cambios:**
1. **Gráfica de nivel** (`updateChart`): eje X labels dividir por 60, cambiar label a `Tiempo (min)`
2. **Gráfica bomba vs sistema** (`updatePumpChart`): si muestra tiempo, convertir a minutos
3. **Tabla de resultados**: columna `t (s)` → `t (min)`, valor `(state.time / 60).toFixed(2)`
4. **GA1 tag TI-001**: donde muestra tiempo real, dividir por 60 y mostrar `min`
5. **CSV export**: columna `t (s)` → `t (min)`, valor dividido entre 60

**Líneas afectadas:** ~8 líneas dispersas en `main.js`

- [ ] **3.1** Convertir todas las salidas de tiempo a minutos

### Tarea 3.2 — Convertir presiones de bar a mca (Mejora 3)

**Archivo:** `app/static/js/main.js`

**Cambios:** Factor de conversión: `mca = bar × 10.1972`

Puntos de conversión:
1. **Tabla de resultados**: columnas `P suc`, `ΔP válv`, `P desc`, `ΔP total` → de `bar` a `mca`
2. **GA1 panel P-001**: `P suc: X bar` → `P suc: X mca`
3. **GA1 panel V-001**: `ΔP: X bar` → `ΔP: X mca`
4. **GA1 panel FI-001**: `P desc: X bar` → `P desc: X mca`
5. **CSV export**: las mismas columnas, unidades en header
6. **Panel resumen hidráulico**: si muestra presiones en bar, convertir

**Líneas afectadas:** ~15 líneas dispersas en `main.js`

- [ ] **3.2** Convertir todas las presiones de bar a mca

### Tarea 3.3 — Centrar diagrama GA1 en el canvas (Mejora 6)

**Archivo:** `app/static/js/main.js` — función `drawGA1()` (línea 1095)

**Problema actual:** `tankX = paddingX` (línea 1147) posiciona el tanque fijo a la izquierda. El ancho total del sistema depende de cuántos componentes hay, pero no se calcula para centrar.

**Cambio concreto:**
1. Después de calcular todos los tamaños (línea ~1144), calcular el ancho total del sistema:
   - `systemWidth = destX + tagZoneW + 10 - tankX + paddingX` (aprox. desde borde izq del tanque hasta borde der de tags)
   - Pero es más preciso: calcular el ancho que ocupan los componentes (tanque hasta destino) + la zona de tags
2. Calcular offset: `offsetX = Math.max(0, (W - systemWidth) / 2)`
3. Aplicar: `tankX = offsetX + paddingX` en vez de `tankX = paddingX`

El cambio es mínimo: solo se modifica la asignación de `tankX` y se agrega 2-3 líneas de cálculo previo.

**Líneas afectadas:** ~5 líneas modificadas/nuevas (líneas 1133-1148)

- [ ] **3.3** Calcular offset horizontal y centrar el diagrama GA1

### Tarea 3.4 — Etiqueta dinámica de tipo de bomba en GA1 (Mejora 7)

**Archivo:** `app/static/js/main.js` — función `drawPumpISO()` (línea 1898)

**Cambio concreto:**
- Reemplazar `ctx.fillText('P-001 - Bomba Centrifuga', ...)` por lectura dinámica:
```javascript
const pumpTypeSelect = document.getElementById('pump_type');
const pumpLabel = pumpTypeSelect && pumpTypeSelect.value === 'desplazamiento'
    ? 'P-001 - Bomba Desplaz. Positivo'
    : 'P-001 - Bomba Centrífuga';
ctx.fillText(pumpLabel, panelX + Math.floor(10 * scale), panelY + Math.floor(18 * scale));
```

**Líneas afectadas:** 1 línea reemplazada por ~4 líneas (línea 1898)

- [ ] **3.4** Hacer dinámica la etiqueta de tipo de bomba en `drawPumpISO()`

---

## Fase 4: Reporte PDF

### Tarea 4.1 — Agregar gráfica Volumen vs Tiempo al PDF (Mejora 5)

**Archivo:** `app/static/js/main.js` — función `exportToPDF()`

**Cambio:** Después de las tablas de resumen, agregar una nueva página con la gráfica de Volumen [m³] vs Tiempo [min]. Usar Chart.js para generar un canvas temporal off-screen, renderizar la gráfica, convertir a imagen con `toDataURL()`, e insertarla en el PDF con jsPDF `addImage()`.

**Líneas afectadas:** ~30 líneas nuevas en `exportToPDF()`

- [ ] **4.1** Gráfica Volumen vs Tiempo en PDF

### Tarea 4.2 — Sección de balance hidráulico detallado en PDF (Mejora 5)

**Archivo:** `app/static/js/main.js` — función `exportToPDF()`

**Cambio:** Agregar nueva sección "Balance Hidráulico" al PDF, evaluada en dos puntos (inicial y final/alarma). Los datos ya están disponibles en `simulationData[0]` y `simulationData[lastIndex]`. Toda la sección usa unidades mca.

Contenido de la tabla:
| Parámetro | Punto Inicial | Punto Final |
|---|---|---|
| Nivel del tanque [m] | | |
| h_atm [mca] | | |
| h_f succión [mca] | | |
| h_k succión [mca] | | |
| h_válvula [mca] | | |
| P succión [mca man.] | | |
| TDH bomba [mca] | | |
| h_f descarga [mca] | | |
| h_k descarga [mca] | | |
| NPSHa [mca] | | |
| NPSHr [mca] | | |
| Margen NPSHa/NPSHr | | |

**Nota:** Algunos campos intermedios (h_f_suc separado de h_k_suc) requieren que el backend envíe estos valores desglosados. Actualmente `state` ya tiene `h_loss_pipe`, `h_loss_valve`, `h_loss_fittings` separados. Para descarga, solo hay `dp_discharge` combinado — se necesitará desglosar o usar el valor combinado.

**Líneas afectadas:** ~50 líneas nuevas en `exportToPDF()`

- [ ] **4.2** Tabla de balance hidráulico detallado en PDF

---

## Resumen de Archivos a Modificar

| Archivo | Tareas | Tipo de cambio |
|---|---|---|
| `app/utils/simulation.py` | 1.1, 1.2, 2.3 | Bug fix + nuevo parámetro |
| `app/utils/valves_db.py` | 2.4 | Catálogo ampliado |
| `main.py` | 2.3, 2.6 | Parámetros + cálculo K |
| `app/templates/index.html` | 2.1, 2.5 | Selectores nuevos |
| `app/static/js/main.js` | 2.2, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2 | Frontend completo |

**Total:** 5 archivos, 0 archivos nuevos, ~14 tareas atómicas.

---

## Orden de Ejecución Propuesto

1. **Fase 1** (Tareas 1.1, 1.2) — Corregir solver primero, es el bug más crítico
2. **Fase 2** (Tareas 2.1-2.6) — Parámetros y catálogo, porque afectan los cálculos
3. **Fase 3** (Tareas 3.1-3.4) — Presentación visual, son cambios independientes en frontend
4. **Fase 4** (Tareas 4.1-4.2) — PDF al final, ya que usa los datos con formato correcto

---

## Notas Técnicas

- Las conversiones de unidades (bar→mca, s→min) son **solo en presentación** (frontend). El backend sigue calculando en sus unidades internas (bar, segundos, metros).
- El catálogo Crane TP-410 usa `K = n × f_T` donde `f_T` depende del diámetro. Esto requiere conocer el diámetro nominal en pulgadas, que ya está disponible en el request como `pipe_size`.
- El centrado del GA1 solo requiere un offset horizontal. No se modifica la lógica de posicionamiento relativo entre componentes.
- La etiqueta de bomba lee directamente del DOM (`#pump_type`), no requiere cambios en el backend.
