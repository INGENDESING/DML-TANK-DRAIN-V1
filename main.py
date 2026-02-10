"""
DML Ingenieros - Simulador de Vaciado de Tanques
Backend Flask
"""
from flask import Flask, render_template, jsonify, request
import os
import math

app = Flask(__name__, template_folder='app/templates', static_folder='app/static')
# SECRET_KEY debe configurarse como variable de entorno
# Ejemplo: export SECRET_KEY='tu_clave_secreta_aqui'
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'cambiar_en_produccion')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy", "app": "DML Tank Simulation"})

# Validación de rangos para inputs del simulador
VALIDATION_RANGES = {
    'tank_diameter': (0.5, 20.0),  # Min, Max en metros
    'tank_height': (0.5, 30.0),
    'initial_level': (0.1, 30.0),
    'altitude': (0, 5000),  # msnm
    'pipe_length': (1.0, 500.0),
    'height_to_pump': (-50.0, 50.0),
    'discharge_length': (1.0, 500.0),
    'discharge_height': (0.0, 200.0),
    'discharge_pressure': (0.0, 100.0),  # bar
    'fluid_density': (500, 2000),  # kg/m³
    'fluid_viscosity': (0.1, 10000),  # cP
    'fluid_vapor_pressure': (0.0, 10.0),  # bar abs
    'valve_open': (0, 100),
    'pump_flow': (0.1, 5000),  # m³/h - para modo flow_fixed
    'pump_npshr_single': (0.1, 10.0),
    'pump_efficiency': (1, 100),
    'nozzle_diameter': (1, 48),  # Pulgadas
}

def validate_input(key, value):
    """Valida que un valor esté dentro del rango permitido."""
    if key not in VALIDATION_RANGES:
        return True  # Sin validación para este campo
    min_val, max_val = VALIDATION_RANGES[key]
    try:
        val = float(value)
        return min_val <= val <= max_val
    except (ValueError, TypeError):
        return False

@app.route('/simulate', methods=['POST'])
def run_simulation():
    try:
        data = request.json

        # === VALIDAR ENTRADAS CRÍTICAS ===
        # Validar campos numéricos principales
        validation_errors = []

        # Campos directos del request
        direct_fields = ['tank_diameter', 'tank_height', 'initial_level', 'altitude',
                        'pipe_length', 'height_to_pump', 'fluid_density',
                        'fluid_viscosity', 'fluid_vapor_pressure', 'valve_open']
        for field in direct_fields:
            if field in data:
                if not validate_input(field, data[field]):
                    validation_errors.append(f"{field} fuera de rango")

        # Validar pump_flow si está en modo flow_fixed
        calc_mode = data.get('calc_mode', 'pressure_fixed')
        if calc_mode == 'flow_fixed' and 'pump_flow' in data:
            if not validate_input('pump_flow', data['pump_flow']):
                validation_errors.append("pump_flow fuera de rango")
            
            # Validate other pump fixed parameters
            if 'pump_npshr_single' in data and not validate_input('pump_npshr_single', data['pump_npshr_single']):
                 validation_errors.append("pump_npshr_single fuera de rango")
            
            if 'pump_efficiency' in data and not validate_input('pump_efficiency', data['pump_efficiency']):
                 validation_errors.append("pump_efficiency fuera de rango")

        # Validate nozzle diameter
        if 'nozzle_diameter' in data:
             # Check if it's in the allowed list or range (using range for now based on VALIDATION_RANGES)
             if not validate_input('nozzle_diameter', data['nozzle_diameter']):
                 validation_errors.append("nozzle_diameter fuera de rango")

        if validation_errors:
            return jsonify({"error": "Validación: " + "; ".join(validation_errors)}), 400

        # === PARSEAR ENTRADAS ===
        # Condiciones del sitio
        altitude = float(data.get('altitude', 0))

        # Tanque
        tank_diam = float(data.get('tank_diameter', 3.0))
        tank_height = float(data.get('tank_height', 5.0))
        init_level = float(data.get('initial_level', 4.5))
        nozzle_diam = float(data.get('nozzle_diameter', 4))
        head_type = data.get('head_type', 'ASME_FD')

        # Tubería de succión
        pipe_std = data.get('pipe_standard', 'ANSI_SCH40')
        pipe_size = data.get('pipe_size', '4.0')
        pipe_len = float(data.get('pipe_length', 10.0))
        height_to_pump = float(data.get('height_to_pump', 2.0))

        # Línea de descarga
        discharge_data = data.get('discharge', {})
        discharge_pipe_size = discharge_data.get('pipe_size', '4.0')
        discharge_length = float(discharge_data.get('length', 20.0))
        discharge_height = float(discharge_data.get('height', 10.0))
        discharge_pressure = float(discharge_data.get('pressure', 2.0))

        # Accesorios
        accessories = data.get('accessories', {})
        n_elbow90 = int(accessories.get('elbow90', 2))
        n_elbow45 = int(accessories.get('elbow45', 0))
        n_tee = int(accessories.get('tee', 0))
        has_filter = accessories.get('filter', True)
        has_reduction = accessories.get('reduction', True)
        has_expansion = accessories.get('expansion', False)

        # Válvula
        valve_type = data.get('valve_type', 'MARIPOSA')
        valve_open = float(data.get('valve_open', 100))

        # Fluido
        fluid_density = float(data.get('fluid_density', 998))
        fluid_viscosity = float(data.get('fluid_viscosity', 1.0))  # cP
        fluid_vapor_pressure = float(data.get('fluid_vapor_pressure', 0.032))  # bar

        # === IMPORTAR MÓDULOS ===
        from app.utils.tank import Tank
        from app.utils.fluid_props import Fluid
        from app.utils.pipes_db import get_pipe_id, PIPES_DB
        from app.utils.valves_db import get_valve_k, VALVES_DB
        from app.utils.pumps_db import PumpCurve, PumpPoint
        from app.utils.simulation import Simulation
        from app.utils.hydraulics import g, calculate_cv, get_velocity_alarm_status

        # === CREAR OBJETOS ===
        # Fluido
        fluid = Fluid(fluid_density, fluid_viscosity, fluid_vapor_pressure)

        # Tanque
        tank = Tank(tank_diam, tank_height, head_type=head_type)

        # Tubería
        pipe_id = get_pipe_id(pipe_std, pipe_size)
        if not pipe_id:
            return jsonify({"error": f"Tamaño de tubería '{pipe_size}' no encontrado en norma {pipe_std}. "
                                             f"Tamaños disponibles: {list(PIPES_DB[pipe_std]['dimensions'].keys())}"}), 400

        pipe_roughness = PIPES_DB[pipe_std]["roughness"]

        # Calcular K de accesorios
        k_fittings = 0.5  # Entrada de tanque (borda)
        k_fittings += n_elbow90 * 0.3  # Codos 90° radio largo
        k_fittings += n_elbow45 * 0.2  # Codos 45°
        k_fittings += n_tee * 1.0  # Tees flujo ramal
        if has_filter:
            k_fittings += 2.0  # Filtro Y típico
        if has_reduction:
            k_fittings += 0.5  # Reducción excéntrica
        if has_expansion:
            k_fittings += 0.2  # Ampliación

        pipe_specs = {
            "length": pipe_len,
            "id": pipe_id,
            "roughness": pipe_roughness,
            "k_fittings": k_fittings,
            "height_diff": -height_to_pump  # Negativo porque bomba está abajo
        }

        # Línea de descarga
        discharge_pipe_id = get_pipe_id(pipe_std, discharge_pipe_size)
        if not discharge_pipe_id:
            discharge_pipe_id = pipe_id  # Usar mismo diámetro si no se encuentra
            # Warning silencioso: se puede loggear pero no interrumpir la simulación

        # Calcular K de accesorios de descarga
        discharge_elbow90 = int(discharge_data.get('elbow90', 2))
        discharge_check_valve = int(discharge_data.get('check_valve', 1))
        k_discharge_fittings = discharge_elbow90 * 0.3  # Codos 90°
        if discharge_check_valve:
            k_discharge_fittings += 2.0  # Válvula check (swing)

        discharge_specs = {
            "length": discharge_length,
            "id": discharge_pipe_id,
            "roughness": pipe_roughness,  # Critical: Required for friction calculation
            "height": discharge_height,
            "pressure_bar": discharge_pressure,
            "k_fittings": k_discharge_fittings
        }

        # Válvula
        k_valve = get_valve_k(valve_type, valve_open)
        valve_data = {
            "type": valve_type,
            "k": k_valve,
            "percent_open": valve_open
        }

        # Configuración de simulación (necesario antes de crear bomba)
        calc_mode = data.get('calc_mode', 'pressure_fixed')

        # Bomba - según modo de cálculo
        if calc_mode == 'flow_fixed':
            # Modo Flujo Fijo: leer un solo punto
            pump_flow = float(data.get('pump_flow', 50.0))
            pump_npshr_single = float(data.get('pump_npshr_single', 2.0))
            pump_efficiency = float(data.get('pump_efficiency', 75.0)) / 100.0  # Convertir % a decimal
            pump = PumpPoint(pump_flow, pump_npshr_single, pump_efficiency)
            fixed_flow = pump_flow  # Usar pump_flow para la simulación
        else:
            # Modo Presión Fija: leer curva completa
            pump_flows = data.get('pump_flows', [0, 20, 40, 60, 80])
            pump_heads = data.get('pump_heads', [60, 58, 55, 50, 42])
            pump_npshr = data.get('pump_npshr', [1.0, 1.2, 1.5, 2.0, 3.0])
            pump = PumpCurve(pump_flows, pump_heads, pump_npshr)
            fixed_flow = None  # No se usa en modo pressure_fixed

        # === EJECUTAR SIMULACIÓN ===
        sim = Simulation(tank, pipe_specs, valve_data, pump, fluid, init_level,
                        discharge_specs=discharge_specs,
                        calc_mode=calc_mode, fixed_flow=fixed_flow or 50.0)

        # Establecer altitud para corrección de presión atmosférica
        sim.set_altitude(altitude)

        max_steps = 8000
        dt = 0.5
        results = []
        min_level = None
        min_level_index = -1

        for i in range(max_steps):
            state = sim.step(dt)

            # Agregar datos adicionales para el frontend
            state['dp_pipe'] = state.get('h_loss_pipe', 0) * fluid_density * g / 1e5
            state['dp_valve'] = state.get('h_loss_valve', 0) * fluid_density * g / 1e5

            # Calcular Cv de la válvula usando función consolidada
            sg = fluid_density / 1000  # Gravedad específica
            state['cv'] = calculate_cv(state['flow_m3h'], state['dp_valve'], sg)

            # Estado de alarma de velocidad (succión)
            state['velocity_alarm_status'] = get_velocity_alarm_status(state['velocity_ms'], is_suction=True)

            results.append(state)

            # Detectar nivel mínimo (cavitación)
            if state['alarm']:
                if min_level_index < 0:
                    min_level = state['level']
                    min_level_index = i
                # Parada inmediata por cavitación (solicitud urgente)
                break

            # Parar si nivel muy bajo
            if state['level'] < 0.01:
                break

        # === PREPARAR RESPUESTA ===
        vol_total = tank.vol_total
        h_head = tank.h_head

        return jsonify({
            "results": results,
            "tank_meta": {
                "D": tank_diam,
                "H": tank_height,
                "h_head": h_head,
                "vol_total": vol_total,
                "nozzle": nozzle_diam
            },
            "min_level": min_level if min_level else 0,
            "min_level_index": min_level_index
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("=" * 50)
    print(" DML INGENIEROS - Simulador de Vaciado")
    print(f" Servidor iniciado en: http://localhost:{port}")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=port)
