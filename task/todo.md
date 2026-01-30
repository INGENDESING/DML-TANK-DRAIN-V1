# Plan de Proyecto - Cálculo Dinámico de Vaciado de Tanques

## Fase 0: Configuración y Control de Versiones (Git/GitHub)

- [x] Crear archivo `.gitignore` (Python, venv, IDEs).
- [x] Crear `README.md` con descripción del proyecto y cómo ejecutarlo.
- [x] Crear `requirements.txt` inicial.
- [x] Inicializar repositorio Git local (`git init`).
- [x] Realizar primer commit "Initial commit".
- [ ] (Manual del Usuario) Instrucciones para subir a GitHub remoto.

## Fase 1: Estructura del Proyecto y Backend Base

- [ ] Estructura de directorios:

    ```text
    /app
        /static (css, js, img)
        /templates (html)
        /utils (cálculos)
    main.py
    ```

- [ ] Configurar servidor Flask básico (main.py).
- [ ] Configurar sistema de logging básico.

## Fase 2: Bases de Datos de Ingeniería (Data Structures)

- [ ] Definir diccionarios/JSON para Propiedades de Tuberías (BPE, ANSI, DIN) en `app/utils/pipes_db.py`.
- [ ] Definir diccionarios para Coeficientes de Válvulas y Accesorios en `app/utils/valves_db.py`.
- [ ] Definir curvas de bombas (estructura de datos para interpolación) en `app/utils/pumps_db.py`.

## Fase 3: Lógica de Cálculo (Python Core)

- [ ] `app/utils/fluid_props.py`: Funciones para densidad, viscosidad, Pv.
- [ ] `app/utils/tank.py`: Clase `Tanque` (Cálculo de volumen vs altura, geometría torisférica).
- [ ] `app/utils/hydraulics.py`: Cálculo de pérdidas de carga (Darcy-Weisbach, accesorios).
- [ ] `app/utils/simulation.py`:
  - [ ] Integración numérica (Euler o Runge-Kutta simple) para vaciado en el tiempo.
  - [ ] Cálculo de NPSH disponible vs Requerido.
  - [ ] Lógica de control (Paro si NPSHa < 1.2 * NPSHr).
- [ ] Crear Tests Unitarios simples para validar cálculos básicos.

## Fase 4: Desarrollo Frontend (Interfaz "Maestría")

- [ ] **Diseño y Branding**:
  - [ ] Implementar tema "Windows Dark Mode" (Fondos oscuros #1f1f1f, efectos Acrylic/Glass, tipografía Segoe UI).
  - [ ] Ubicar `LOGO DML INGENIEROS.png` en `app/static/img/`.
  - [ ] Crear Header con Logo DML y Título.
  - [ ] Crear Footer con créditos: "Author: Jonathan Arboleda Genes Msc chemical engineering".
- [ ] `templates/index.html`: Layout principal con estructura semántica.
- [ ] `templates/components/form_input.html`: Formularios estéticos con estilos Windows 11.
- [ ] `static/js/main.js`: Lógica de comunicación con API (AJAX/Fetch).
- [ ] **Gráfica GA1 (Animada)**:
  - [ ] Implementar visualización SVG/Canvas del tanque y tubería.
  - [ ] Visualización dinámica de nivel, presiones y caudales.
  - [ ] Indicadores de alarma visuales.
- [ ] **Gráficas de Datos**:
  - [ ] Gráfica Chart.js o Plotly para "Nivel vs Tiempo".
- [ ] **Tablas de Resultados**:
  - [ ] Tabla de resumen de simulación (tiempos, niveles, presiones).

## Fase 5: Revisión y Refinamiento

- [ ] Verificación cruzada de resultados (Validación de ingeniería).
- [ ] Ajustes finales de UI/UX (animaciones suaves, feedback visual).
- [ ] Limpieza de código y refactorización.
- [ ] Sección de Revisión Final en `todo.md`.
