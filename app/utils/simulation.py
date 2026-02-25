
import math
import numpy as np
import logging
from app.utils.hydraulics import (calculate_velocity, calculate_reynolds,
                                  calculate_friction_factor, calculate_head_loss_pipe,
                                  calculate_head_loss_fittings, g)

# Configurar logging
logger = logging.getLogger(__name__)

class Simulation:
    def __init__(self, tank, pipe_specs, valve_data, pump_curve, fluid, initial_level_h,
                 min_level_h=0.1, discharge_specs=None, calc_mode='pressure_fixed', fixed_flow=50.0,
                 npsh_margin=1.2):
        """
        :param tank: Objeto Tank
        :param pipe_specs: Dict succión
        :param valve_data: Dict válvula
        :param pump_curve: Objeto PumpCurve
        :param fluid: Objeto Fluid
        """
        self.tank = tank
        self.pipe = pipe_specs
        self.valve = valve_data
        self.pump = pump_curve
        self.fluid = fluid
        self.current_level = initial_level_h
        self.min_level = min_level_h
        
        self.discharge = discharge_specs
        self.calc_mode = calc_mode
        self.fixed_flow = fixed_flow
        self.npsh_margin = npsh_margin

        # Presión atmosférica corregida por altitud (se recibe en inicialización)
        self.patm_pa = 101325  # Default, se actualiza con set_altitude si se proporciona

        # Estado inicial
        self.time = 0.0
        self.results = []

    def set_altitude(self, altitude_m):
        """Actualiza la presión atmosférica basada en la altitud [msnm]."""
        # Fórmula barométrica: P = 101325 × (1 - 2.25577×10⁻⁵ × h)^5.25588
        h = max(0, altitude_m)
        self.patm_pa = 101325 * math.pow(1 - 2.25577e-5 * h, 5.25588)
        
        # Calcular volumen inicial
        self.current_vol = self.tank.get_volume_from_level(self.current_level)

    def step(self, dt=1.0):
        """
        Avanza la simulación dt segundos.
        Dos modos:
        1. pressure_fixed: Q se calcula iterando (Bomba vs Sistema)
        2. flow_fixed: Q es fijo, calculamos P_destino resultante
        """
        
        # --- 1. DETERMINAR CAUDAL ---
        simulation_flow_m3_h = 0.0
        
        # Preparar datos de descarga
        h_dest_pressure = 0
        z_dest = 0
        if self.discharge:
            # Convertir presión destino a metros de columna de líquido
            h_dest_pressure = (self.discharge['pressure_bar'] * 1e5) / (self.fluid.rho * g)
            z_dest = self.discharge['height']
        else:
            h_dest_pressure = 20.0 # Default fallback
            z_dest = 10.0

        if self.calc_mode == 'flow_fixed':
            # MODO 1: Flujo Fijo
            simulation_flow_m3_h = self.fixed_flow
            
        else:
            # MODO 2: Presión Destino Fija (Iterativo)
            # Head requerido total = Z_static_total + P_dest_head
            # Z_static_total = Z_dest - Z_succion (Z_succion = Nivel + Z_diff)
            # Z_diff es negativo (bomba abajo). 
            # Elevación total a vencer = Z_dest - (Level + Z_diff)
            
            # Pasamos los parámetros estáticos al solver
            height_diff = self.pipe.get('height_diff', 0)
            # static_head_system incluye nivel actual como cabeza favorable
            static_head_system = z_dest + h_dest_pressure - self.current_level - height_diff
            # Solver busca Q tal que: H_pump(Q) = Static + Losses(Q)
            logger.debug(f'level={self.current_level:.3f}, z_dest={z_dest:.2f}, h_dest_p={h_dest_pressure:.2f}, static_head={static_head_system:.2f}')
            simulation_flow_m3_h = self._solve_flow(self.current_level, self.pump, static_head_system)
            logger.debug(f'FLOW: Q={simulation_flow_m3_h:.2f} m3/h')
        simulation_flow_m3_s = simulation_flow_m3_h / 3600.0

        # --- 2. CÁLCULOS HIDRÁULICOS ---
        
        # A. Lado Succión
        vel_suction = calculate_velocity(simulation_flow_m3_h, math.pi * (self.pipe['id']/2)**2)
        re_suction = calculate_reynolds(self.fluid.rho, vel_suction, self.pipe['id'], self.fluid.mu)
        f_suction = calculate_friction_factor(re_suction, self.pipe['roughness'], self.pipe['id'])
        
        h_loss_pipe_suc = calculate_head_loss_pipe(f_suction, self.pipe['length'], self.pipe['id'], vel_suction)
        h_loss_valve = calculate_head_loss_fittings(self.valve['k'], vel_suction)
        h_loss_fittings_suc = calculate_head_loss_fittings(self.pipe['k_fittings'], vel_suction)
        
        total_suction_loss = h_loss_pipe_suc + h_loss_valve + h_loss_fittings_suc

        # B. Lado Descarga
        h_loss_discharge = 0
        if self.discharge:
            vel_dis = calculate_velocity(simulation_flow_m3_h, math.pi * (self.discharge['id']/2)**2)
            re_dis = calculate_reynolds(self.fluid.rho, vel_dis, self.discharge['id'], self.fluid.mu)
            f_dis = calculate_friction_factor(re_dis, self.discharge['roughness'], self.discharge['id'])
            h_loss_discharge = calculate_head_loss_pipe(f_dis, self.discharge['length'], self.discharge['id'], vel_dis)
            # Usar K de accesorios de descarga (configurable desde frontend)
            k_discharge = self.discharge.get('k_fittings', 2.6)  # Default: 2 codos + check
            h_loss_discharge += calculate_head_loss_fittings(k_discharge, vel_dis)

        # --- 3. RESULTADOS DE PRESIÓN ---
        
        # NPSH Disponible
        # P_succion_abs = Patm + rho*g*(Level + Z_diff) - Losses_suc
        z_suction_datum = self.current_level + self.pipe.get('height_diff', 0)
        p_atm_head = self.patm_pa / (self.fluid.rho * g)
        pv_head = self.fluid.pv / (self.fluid.rho * g)

        npsh_a = p_atm_head + z_suction_datum - total_suction_loss - pv_head
        npsh_r = self.pump.get_npsh_required(simulation_flow_m3_h)

        # Presión Succión (manométrica)
        p_suction_head_gauge = z_suction_datum - total_suction_loss
        p_suction_bar = (p_suction_head_gauge * self.fluid.rho * g) / 1e5

        # Cabeza de Bomba
        pump_head = self.pump.get_head(simulation_flow_m3_h)

        # Presión Destino y Cálculo de TDH según modo
        if pump_head is None:
            # MODO FLOW_FIXED: pump.get_head() retorna None
            # La presión destino se calcula para satisfacer el flujo fijo
            # Balance: P_dest = P_succion + TDH_sistema - Losses_discharge - Z_dest
            # Donde TDH_sistema es lo que la bomba debe proporcionar
            p_dest_head_calculated = p_suction_head_gauge - h_loss_discharge - z_dest

            # En modo flow_fixed, TDH es la cabeza que la bomba debe generar
            # Se calcula como: P_dest_head - P_suction_head + losses + Z_dest
            # Pero como P_dest viene del input, calculamos el TDH resultante
            p_dest_head_calculated = h_dest_pressure  # Usar el valor de destino del input
            pump_head = p_dest_head_calculated - p_suction_head_gauge + h_loss_discharge + z_dest

            p_dest_bar_result = (p_dest_head_calculated * self.fluid.rho * g) / 1e5
        else:
            # MODO PRESSURE_FIXED: TDH viene de la curva de bomba
            # Balance: P_dest_head = P_succion_head + Pump_Head - Losses_discharge - Z_dest
            p_dest_head_calculated = p_suction_head_gauge + pump_head - h_loss_discharge - z_dest
            p_dest_bar_result = (p_dest_head_calculated * self.fluid.rho * g) / 1e5

        # --- 3.5 CÁLCULO DE POTENCIA ---
        # P = (Q * TDH * rho * g) / (eficiencia * 3600 * 1000)  [kW]
        pump_efficiency = self.pump.get_efficiency(simulation_flow_m3_h)
        pump_power_kw = (simulation_flow_m3_h * pump_head * self.fluid.rho * g) / \
                        (pump_efficiency * 3600 * 1000)

        # Presión diferencial (descarga - succión) en bar
        pressure_diff_bar = p_dest_bar_result - p_suction_bar

        # --- 4. ACTUALIZACIÓN EULER ---
        
        # Detector de alarma - API 610: NPSHa >= max(1.3×NPSHr, NPSHr + 0.6m)
        # Usamos factor 1.2 para sincronizar con frontend
        alarm = False
        npsh_required = max(self.npsh_margin * npsh_r, npsh_r + 0.6)
        if npsh_a < npsh_required:
            alarm = True
            
        vol_removed = simulation_flow_m3_s * dt
        self.current_vol -= vol_removed
        if self.current_vol < 0: self.current_vol = 0
        
        self.current_level = self._solve_level_from_vol(self.current_vol)
        self.time += dt

        # Determinar régimen de flujo
        if re_suction < 2300:
            flow_regime = "Laminar"
        elif re_suction < 4000:
            flow_regime = "Transición"
        else:
            flow_regime = "Turbulento"

        state = {
            "time": self.time,
            "level": self.current_level,
            "volume": self.current_vol,
            "flow_m3h": simulation_flow_m3_h,
            "velocity_ms": vel_suction,
            "reynolds": re_suction,
            "flow_regime": flow_regime,
            "friction_factor": f_suction,
            "pressure_suction_bar": p_suction_bar,
            "pressure_discharge_bar": p_dest_bar_result, # Resultado en destino
            "pressure_diff_bar": pressure_diff_bar,
            "pump_head_m": pump_head,
            "pump_power_kw": pump_power_kw,
            "pump_efficiency": pump_efficiency,
            "npsh_a": npsh_a,
            "npsh_r": npsh_r,
            "alarm": alarm,
            "dp_valve": (h_loss_valve * self.fluid.rho * g) / 1e5,
            "h_loss_pipe": h_loss_pipe_suc,
            "h_loss_valve": h_loss_valve,
            "h_loss_fittings": h_loss_fittings_suc,
            "h_loss_total": total_suction_loss + h_loss_discharge,
            "dp_discharge": (h_loss_discharge * self.fluid.rho * g) / 1e5
        }
        self.results.append(state)
        return state

    def _solve_flow(self, level, pump, head_required_system):
        """
        Encuentra Q (m3/h) tal que Head_Pump(Q) = Head_System(Q, level)
        usando método de bisección.

        Curva del Sistema: H_sys = H_estática + H_fricción(Q) + H_accesorios(Q) + H_destino
        Curva de la Bomba: H_pump = f(Q) interpolada

        Punto de operación: H_pump(Q) = H_sys(Q)
        Resolvemos: H_pump(Q) - H_sys(Q) = 0
        """
        # Rango de búsqueda (m3/h)
        q_min = 0.1  # Caudal mínimo para evitar división por cero
        # Obtener q_max según el tipo de bomba
        if hasattr(pump, 'flow_points'):
            q_max = float(pump.flow_points[-1]) * 1.5  # PumpCurve: extender 50% para encontrar intersección real
        else:
            q_max = pump.flow * 2.0  # PumpPoint: usar el flujo nominal como referencia

        # Altura estática ya incluida en head_required_system, solo pérdidas aquí
        z_static = 0  # Nivel ya restado en static_head_system

        def system_head(q_m3h):
            """Calcula la cabeza requerida del sistema para un caudal dado"""
            if q_m3h <= 0:
                return head_required_system  # Retornar cabeza estática mínima

            # Calcular velocidad succión
            area = math.pi * (self.pipe['id'] / 2) ** 2
            vel = calculate_velocity(q_m3h, area)

            # Reynolds y factor de fricción succión
            re = calculate_reynolds(self.fluid.rho, vel, self.pipe['id'], self.fluid.mu)
            f = calculate_friction_factor(re, self.pipe['roughness'], self.pipe['id'])

            # Pérdidas en tubería succión
            h_pipe = calculate_head_loss_pipe(f, self.pipe['length'], self.pipe['id'], vel)

            # Pérdidas en accesorios + válvula succión
            k_total = self.pipe['k_fittings'] + self.valve['k']
            h_fittings = calculate_head_loss_fittings(k_total, vel)

            # Pérdidas en descarga
            h_discharge = 0
            if self.discharge:
                area_dis = math.pi * (self.discharge['id'] / 2) ** 2
                vel_dis = calculate_velocity(q_m3h, area_dis)
                re_dis = calculate_reynolds(self.fluid.rho, vel_dis, self.discharge['id'], self.fluid.mu)
                f_dis = calculate_friction_factor(re_dis, self.discharge['roughness'], self.discharge['id'])
                h_discharge = calculate_head_loss_pipe(f_dis, self.discharge['length'], self.discharge['id'], vel_dis)
                k_dis = self.discharge.get('k_fittings', 2.6)
                h_discharge += calculate_head_loss_fittings(k_dis, vel_dis)

            # Cabeza total del sistema = estática + pérdidas succión + pérdidas descarga
            return h_pipe + h_fittings + h_discharge + head_required_system

        def residual(q_m3h):
            """Diferencia entre cabeza de bomba y cabeza del sistema"""
            h_pump = pump.get_head(q_m3h)
            h_sys = system_head(q_m3h)
            return h_pump - h_sys

        # Verificar que existe solución
        res_min = residual(q_min)
        res_max = residual(q_max)

        logger.debug(f'Solver: level={level:.3f}m, H_req={head_required_system:.2f}m')
        logger.debug(f'Solver: Q_range=[{q_min:.1f}, {q_max:.1f}] m3/h')
        logger.debug(f'Solver: res_min={res_min:.2f}, res_max={res_max:.2f}')

        # Si la bomba no puede vencer el sistema ni al mínimo caudal
        if res_min < 0:
            logger.warning(f'Solver: Bomba insuficiente aún a Q_min. H_pump({q_min:.1f})={pump.get_head(q_min):.2f}m < H_sys={system_head(q_min):.2f}m')
            return q_min  # Retornar mínimo en m³/h (casi sin flujo)

        # Si la bomba puede más que el sistema incluso al máximo
        if res_max > 0:
            logger.warning(f'Solver: BOMBA EN RUNOUT. Excede curva del sistema a Q_max. Retornando Q_max={q_max:.1f} m3/h')
            return q_max  # Retornar máximo em m³/h

        # Bisección para encontrar el punto de operación
        tolerance = 0.01  # m3/h
        max_iterations = 50

        q_low = q_min
        q_high = q_max

        for iteration in range(max_iterations):
            q_mid = (q_low + q_high) / 2
            res_mid = residual(q_mid)

            if abs(res_mid) < 0.01 or (q_high - q_low) < tolerance:
                logger.debug(f'Solver: Converged at Q={q_mid:.2f} m3/h after {iteration+1} iterations')
                return q_mid  # Retornar en m³/h (consistente con entrada)

            if res_mid > 0:
                q_low = q_mid  # La bomba aún tiene exceso, aumentar Q
            else:
                q_high = q_mid  # El sistema requiere más, disminuir Q

        logger.debug(f'Solver: Max iterations reached. Best Q={q_mid:.2f} m3/h')
        return q_mid  # Retornar mejor estimación en m³/h

    def _solve_level_from_vol(self, vol):
        """
        Calcula el nivel de líquido dado un volumen usando bisección.
        Precisión mejorada con criterio de convergencia.
        """
        if vol <= 0:
            return 0.0

        # Límites de búsqueda
        low = 0.0
        high = self.tank.H_cyl + 2 * self.tank.h_head

        # Si el volumen excede el total, retornar altura máxima
        if vol >= self.tank.vol_total:
            return high

        # Bisección con criterio de convergencia
        tolerance = 1e-6  # metros (precisión de 0.001 mm)
        max_iterations = 50

        for _ in range(max_iterations):
            mid = (low + high) / 2
            v_est = self.tank.get_volume_from_level(mid)

            # Verificar convergencia
            if abs(v_est - vol) < 1e-9 or (high - low) < tolerance:
                return mid

            if v_est < vol:
                low = mid
            else:
                high = mid

        return (low + high) / 2
