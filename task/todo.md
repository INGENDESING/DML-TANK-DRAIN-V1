# Plan de Mejoras v2 - Simulador de Vaciado de Tanques

**Fecha:** 2026-02-09
**Autor:** Claude (Assistant)

---

## Tareas

### Fase 1: Cálculos / Ingeniería
- [x] **1.1** Selector de tipo de cabeza del tanque (ASME_FD, ELLIPTICAL_2_1, HEMISPHERICAL)
- [x] **1.2** Accesorios configurables en línea de descarga (K real en vez de hardcoded 3.0)
- [x] **1.3** Agregar Reynolds y régimen de flujo a resultados

### Fase 2: Interfaz / UX
- [x] **2.1** Tabla de válvula dinámica (actualizar según frame actual)
- [x] **2.2** Gráfica de curva de bomba vs curva del sistema
- [x] **2.3** Mejoras visuales en GA1 (Reynolds, régimen, presión descarga en tags)

### Fase 3: Funcionalidades Nuevas
- [x] **3.1** Guardar/Cargar configuraciones (localStorage)
- [x] **3.2** Resumen de parámetros hidráulicos en panel lateral

### Fase 4: Calidad de Código
- [x] **4.1** Tests para simulation.py
- [x] **4.2** Tests para fluid_props.py
- [x] **4.3** Manejo de errores mejorado en frontend (inline en vez de alert())

---

## Revisión

### Resumen de cambios realizados

**11 tareas completadas. 41 tests pasaron exitosamente.**

#### 1.1 - Selector de tipo de cabeza
- `index.html`: Agregado `<select>` con 3 opciones (ASME F&D, Elíptica 2:1, Hemisférica) en sección Geometría del Tanque
- `main.py`: Lee `head_type` del request y lo pasa a `Tank(head_type=head_type)`

#### 1.2 - Accesorios descarga configurables
- `index.html`: Agregados inputs para codos 90° y válvula check en sección Descarga
- `main.js`: Envía `elbow90` y `check_valve` en el objeto `discharge`
- `main.py`: Calcula `k_discharge_fittings` y lo pasa en `discharge_specs`
- `simulation.py`: Usa `self.discharge.get('k_fittings', 2.6)` en vez de hardcoded 3.0

#### 1.3 - Reynolds y régimen de flujo
- `simulation.py`: Agrega `reynolds`, `flow_regime`, `friction_factor` al state dict
- `index.html`: Nuevas columnas Re y Régimen en tabla de resultados (colspan=16)
- `main.js`: Muestra Re y régimen en tabla; agrega Re, régimen y f al CSV export

#### 2.1 - Tabla de válvula dinámica
- `main.js`: Extraída función `updateValveTable(p)` reutilizable
- `main.js`: Se llama `updateValveTable(currentState)` en cada frame de la animación

#### 2.2 - Gráfica curva bomba vs sistema
- `index.html`: Nuevo `<canvas id="pumpChart">` después de gráfica de nivel
- `main.js`: Nuevo Chart.js tipo scatter con dos datasets (puntos operación + curva bomba)
- Se actualiza al recibir resultados y se limpia en reset

#### 2.3 - Mejoras visuales GA1
- `main.js`: Panel FI-001 ahora incluye Re, régimen de flujo, y presión de descarga

#### 3.1 - Guardar/Cargar configuraciones
- `index.html`: Botones "Guardar Config" y "Cargar Config"
- `main.js`: Funciones `saveConfig()` y `loadConfig()` usando localStorage
- Serializa todo el formulario incluyendo checkboxes, selects, y actualiza campos derivados

#### 3.2 - Panel resumen hidráulico
- `index.html`: Panel `hydraulic-summary-panel` con tabla resumen
- `main.js`: Función `updateHydraulicSummary()` calcula K total, Re promedio, f promedio, etc.

#### 4.1 - Tests simulation.py
- `tests/test_simulation.py`: 14 tests cubriendo nivel, flujo, tiempo, volumen, Reynolds, alarma, flow_fixed, presiones

#### 4.2 - Tests fluid_props.py
- `tests/test_fluid_props.py`: 9 tests cubriendo propiedades básicas, agua a diferentes temperaturas, conversiones

#### 4.3 - Errores inline frontend
- `index.html`: Div `error-message` con estilo visual (fondo rojo, borde, botón cerrar)
- `main.js`: Funciones `showError()` y `hideError()`. Reemplazados `alert()` por mensajes inline

### Archivos modificados
1. `app/templates/index.html` - HTML (selector cabeza, canvas bomba, accesorios descarga, panel resumen, error inline, botones config)
2. `app/static/js/main.js` - JavaScript (tabla dinámica, gráfica bomba, Re en tabla, guardar/cargar, resumen hidráulico, errores inline)
3. `main.py` - Python Flask (head_type, k_discharge_fittings)
4. `app/utils/simulation.py` - Motor de simulación (reynolds, flow_regime, friction_factor, k_fittings descarga)

### Archivos nuevos
1. `tests/test_simulation.py` - 14 tests
2. `tests/test_fluid_props.py` - 9 tests

### Resultado de tests
```
41 passed in 0.26s
```

---

**Fin del Plan de Mejoras v2 - COMPLETADO**
**Fecha de finalización:** 2026-02-09
