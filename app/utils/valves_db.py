
# Base de datos de coeficientes de resistencia (K) y Cv para válvulas.
# Fuentes aproximadas: Crane TP-410, Perry's Chemical Engineers' Handbook.

# K = fT * Le/D (o valores fijos aproximados para régimen turbulento)

VALVES_DB = {
    # Valores típicos de coeficientes Cv o K a apertura total
    # Para válvulas de control, el Cv varía con la apertura (se manejará en lógica)
    "TYPES": [
        "MARIPOSA", "BOLA", "COMPUERTA", "DIAFRAGMA", "GLOBO", "MIXPROOF"
    ],

    # Coeficientes K aproximados (adimensionales) a apertura completa
    "K_VALUES": {
        "MARIPOSA": 0.35,   # Rango típico 0.2 - 0.5 (Apertura total)
        "BOLA": 0.05,       # Paso total (muy baja pérdida)
        "COMPUERTA": 0.17,  # Abierta totalmente
        "DIAFRAGMA": 2.3,   # Tipo vertedero (Weir)
        "GLOBO": 6.0,       # Alta pérdida de carga
        "MIXPROOF": 1.5,    # Asumiendo similar a asiento doble (variable)
    },

    # Cv por tamaño (pulgadas) - Valores típicos para válvulas a 100% abiertas
    # Cv = Q / (1.17 * sqrt(ΔP/SG)) donde Q en m³/h, ΔP en bar
    # Fuente: Valores típicos de la industria
    "CV_VALUES": {
        # MARIPOSA (Butterfly) - Cv estándar para válvulas de mariposa
        "MARIPOSA": {
            "1": 30, "1.5": 70, "2": 120, "3": 280,
            "4": 540, "6": 1200, "8": 2100, "10": 3400, "12": 5000
        },
        # BOLA (Ball) - Cv alto debido a paso completo
        "BOLA": {
            "1": 35, "1.5": 80, "2": 150, "3": 350,
            "4": 640, "6": 1450, "8": 2600, "10": 4100, "12": 5900
        },
        # COMPUERTA (Gate) - Cv moderado
        "COMPUERTA": {
            "1": 28, "1.5": 65, "2": 115, "3": 260,
            "4": 480, "6": 1100, "8": 1950, "10": 3100, "12": 4500
        },
        # DIAFRAGMA (Diaphragm) - Cv bajo debido a restricción
        "DIAFRAGMA": {
            "1": 12, "1.5": 28, "2": 55, "3": 120,
            "4": 220, "6": 480, "8": 850, "10": 1400, "12": 2000
        },
        # GLOBO (Globe) - Cv muy bajo debido a múltiples cambios de dirección
        "GLOBO": {
            "1": 8, "1.5": 18, "2": 35, "3": 80,
            "4": 150, "6": 340, "8": 600, "10": 950, "12": 1400
        },
        # MIXPROOF - Cv moderado-bajo
        "MIXPROOF": {
            "1": 15, "1.5": 35, "2": 70, "3": 160,
            "4": 290, "6": 660, "8": 1150, "10": 1850, "12": 2700
        }
    },

    # Accesorios Estándar (K aproximado)
    "FITTINGS": {
        "CODO_90_RL": 0.3,  # Radio Largo
        "CODO_90_RC": 0.75, # Radio Corto
        "CODO_45": 0.2,
        "TEE_FLUJO_DIRECTO": 0.2,
        "TEE_FLUJO_RAMAL": 1.0,
        "REDUCCION": 0.1,   # Depende de la relación de áreas (se calculará en lógica)
        "AMPLIACION": 0.2,  # Depende de la relación de áreas
        "ENTRADA_TANQUE": 0.5, # Borda
        "SALIDA_TANQUE": 1.0,
    }
}

def get_valve_k(valve_type, percent_open=100):
    """
    Retorna el K estimado de la válvula usando curvas de característica inherente.
    
    Tipos de característica:
    - Equal Percentage (EP): Mariposa, Globo - Δ% flujo proporcional a apertura
    - Linear: Bola, Compuerta - Flujo proporcional a apertura
    - Quick Opening: Diafragma - Alta sensibilidad inicial
    
    Basado en: ISA-75.11, Fisher Control Valve Handbook
    
    :param valve_type: Tipo de válvula (MARIPOSA, BOLA, etc.)
    :param percent_open: Porcentaje de apertura (0-100)
    :return: Coeficiente K adimensional
    """
    import math
    
    base_k = VALVES_DB["K_VALUES"].get(valve_type, 1.0)
    
    if percent_open >= 99:
        return base_k
    elif percent_open <= 1:
        return 1e8  # Válvula cerrada (muy alta resistencia)
    
    # Normalizar apertura
    x = percent_open / 100.0
    
    # Seleccionar curva característica según tipo de válvula
    if valve_type in ["MARIPOSA", "GLOBO"]:
        # Equal Percentage: Cv/Cv_max = R^(x-1), donde R típico = 50
        # K aumenta exponencialmente al cerrar
        R = 50.0  # Rangeability típica
        cv_ratio = math.pow(R, x - 1)
        # K es inversamente proporcional a Cv²
        k_eff = base_k / (cv_ratio ** 2)
        
    elif valve_type in ["BOLA", "COMPUERTA"]:
        # Linear: Cv/Cv_max = x
        # Característica casi lineal
        cv_ratio = x
        k_eff = base_k / (cv_ratio ** 2) if cv_ratio > 0.05 else base_k / 0.0025
        
    elif valve_type == "DIAFRAGMA":
        # Quick Opening: Alta ganancia inicial, satura rápido
        # Cv/Cv_max = sqrt(x)
        cv_ratio = math.sqrt(x)
        k_eff = base_k / (cv_ratio ** 2) if cv_ratio > 0.1 else base_k / 0.01
        
    elif valve_type == "MIXPROOF":
        # Mixproof: Similar a compuerta con histéresis
        cv_ratio = x * 0.9 + 0.1  # Offset para evitar cero
        k_eff = base_k / (cv_ratio ** 2)
        
    else:
        # Default: aproximación cuadrática
        k_eff = base_k / (x ** 2) if x > 0.1 else base_k / 0.01
    
    # Limitar K máximo para evitar infinitos
    return min(k_eff, 1e6)

def get_valve_cv(valve_type, size_inches):
    """
    Retorna el Cv de una válvula según su tipo y tamaño.

    :param valve_type: Tipo de válvula (MARIPOSA, BOLA, etc.)
    :param size_inches: Tamaño en pulgadas (1, 1.5, 2, 3, 4, 6, 8, 10, 12)
    :return: Cv en unidades US GPM/√PSI
    """
    # Convertir a string para buscar en diccionario
    size_key = str(size_inches)

    if valve_type not in VALVES_DB["CV_VALUES"]:
        return None

    cv_dict = VALVES_DB["CV_VALUES"][valve_type]
    return cv_dict.get(size_key, cv_dict.get("4", 540))  # Default a 4" si no existe
