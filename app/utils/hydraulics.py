
import math

g = 9.81  # m/s^2

def calculate_velocity(flow_m3_h, area_m2):
    """Calcula velocidad en m/s dado caudal en m3/h y área en m2."""
    if area_m2 <= 0: return 0.0
    flow_m3_s = flow_m3_h / 3600.0
    return flow_m3_s / area_m2

def calculate_reynolds(density, velocity, diameter, viscosity_pa_s):
    """Re = (rho * v * D) / mu"""
    if viscosity_pa_s <= 0 or diameter <= 0: return 0.0
    return (density * abs(velocity) * diameter) / viscosity_pa_s

def calculate_friction_factor(re, roughness, diameter):
    """
    Calcula factor de fricción de Darcy (f) usando Swamee-Jain (aprox explícita de Colebrook).
    epsilon (roughness) y diameter en mismas unidades [m].
    
    Incluye zona de transición (Re 2300-4000) con interpolación lineal.
    """
    if re < 2300:
        # Flujo Laminar
        if re <= 0.1:
            # Caudal casi nulo: retornar f alto para evitar división por cero
            return 640.0  # Equivalente a f(64/0.1) - flujo casi estático
        return 64.0 / re
    elif re < 4000:
        # Zona de Transición: interpolación lineal entre laminar y turbulento
        f_lam = 64.0 / 2300.0  # f a Re=2300
        # f turbulento a Re=4000 usando Swamee-Jain
        if diameter <= 0: return f_lam
        term1_t = roughness / (3.7 * diameter)
        term2_t = 5.74 / (4000.0 ** 0.9)
        f_turb = 0.25 / (math.log10(term1_t + term2_t)**2)
        # Interpolación lineal
        ratio = (re - 2300.0) / 1700.0
        return f_lam + ratio * (f_turb - f_lam)
    else:
        # Turbulento (Swamee-Jain)
        # f = 0.25 / [log10( (epsilon/3.7D) + (5.74/Re^0.9) )]^2
        if diameter <= 0: return 0.0
        term1 = roughness / (3.7 * diameter)
        term2 = 5.74 / (re ** 0.9)
        return 0.25 / (math.log10(term1 + term2)**2)


def calculate_head_loss_pipe(f, length, diameter, velocity):
    """
    Darcy-Weisbach: hL = f * (L/D) * (v^2 / 2g)
    Retorna pérdida en [m] de columna de líquido.
    """
    if diameter <= 0 or velocity == 0: return 0.0
    return f * (length / diameter) * ((velocity**2) / (2 * g))

def calculate_head_loss_fittings(k_total, velocity):
    """
    hL = K * (v^2 / 2g)
    Retorna pérdida en [m].
    """
    return k_total * ((velocity**2) / (2 * g))

def pressure_drop_bar(head_loss_m, density):
    """Convierte pérdida de carga en metros a caída de presión en Bar."""
    # P = rho * g * h
    p_pa = density * g * head_loss_m
    return p_pa / 100000.0 # Pa to Bar

def calculate_cv(flow_m3h, delta_p_bar, specific_gravity=1.0):
    """
    Calcula el coeficiente de flujo Cv de una válvula.
    
    Cv = Q / (1.17 * sqrt(ΔP / SG))
    
    Donde:
    - Q: Caudal en m³/h
    - ΔP: Caída de presión en bar
    - SG: Gravedad específica (ρ_fluido / ρ_agua)
    
    Retorna Cv en unidades estándar: US GPM / √PSI
    
    Conversión incorporada:
    - 1 m³/h = 4.40287 US GPM
    - 1 bar = 14.5038 PSI
    """
    if delta_p_bar <= 0.0001:
        return 0.0
    
    # Fórmula directa con conversión de unidades
    # Cv = Q_gpm * sqrt(SG / dP_psi)
    flow_gpm = flow_m3h * 4.40287
    delta_p_psi = delta_p_bar * 14.5038
    
    return flow_gpm * math.sqrt(specific_gravity / delta_p_psi)

def get_velocity_alarm_status(velocity_ms, is_suction=True):
    """
    Evalúa el estado de alarma de velocidad según buenas prácticas de ingeniería.
    
    Límites recomendados:
    - Succión: máx 1.5-2.0 m/s (warning), >3 m/s (alarm)
    - Descarga: máx 3.0-4.0 m/s (warning), >5 m/s (alarm)
    
    Retorna: 'OK', 'WARNING', 'ALARM'
    """
    if is_suction:
        if velocity_ms > 3.0:
            return 'ALARM'
        elif velocity_ms > 1.8:
            return 'WARNING'
        else:
            return 'OK'
    else:
        # Descarga
        if velocity_ms > 5.0:
            return 'ALARM'
        elif velocity_ms > 3.5:
            return 'WARNING'
        else:
            return 'OK'

