"""
Módulo de curvas de bomba - DML Ingenieros
Soporta dos modos de operación:
1. Presión fija: curva completa Q-TDH-NPSHr (PumpCurve)
2. Flujo fijo: punto único con eficiencia (PumpPoint)
"""

import numpy as np
from abc import ABC, abstractmethod


class PumpBase(ABC):
    """Clase base para todos los tipos de bomba."""

    @abstractmethod
    def get_head(self, flow_q):
        """Retorna el TDH para un caudal dado [m]."""
        pass

    @abstractmethod
    def get_npsh_required(self, flow_q):
        """Retorna el NPSHr para un caudal dado [m]."""
        pass

    @abstractmethod
    def get_efficiency(self, flow_q):
        """Retorna la eficiencia para un caudal dado (decimal 0-1)."""
        pass


class PumpCurve(PumpBase):
    """
    Curva de bomba completa (modo Presión Fija).
    Usa interpolación lineal entre puntos conocidos.
    """

    def __init__(self, flow_points, head_points, npsh_points=None, eff_points=None):
        """
        Inicializa la curva de la bomba con puntos conocidos.

        :param flow_points: Lista de caudales [m3/h]
        :param head_points: Lista de TDH [m]
        :param npsh_points: Lista de NPSHr [m] (opcional)
        :param eff_points: Lista de eficiencias [decimal] (opcional)
        """
        self.flow_points = np.array(flow_points)
        self.head_points = np.array(head_points)
        self.npsh_points = np.array(npsh_points) if npsh_points else None
        self.eff_points = np.array(eff_points) if eff_points else None

        # Validaciones
        if len(self.flow_points) != len(self.head_points):
            raise ValueError("Los puntos de flujo y cabeza deben tener la misma longitud")

        # Validar que no haya valores negativos
        if np.any(self.flow_points < 0):
            raise ValueError("Los caudales deben ser no negativos")
        if np.any(self.head_points < 0):
            raise ValueError("Los TDH deben ser no negativos")
        if self.npsh_points is not None and np.any(self.npsh_points < 0):
            raise ValueError("Los NPSHr deben ser no negativos")
        if self.eff_points is not None and np.any((self.eff_points < 0) | (self.eff_points > 1)):
            raise ValueError("Las eficiencias deben estar entre 0 y 1")

    def get_head(self, flow_q):
        """
        Retorna el TDH para un caudal Q dado usando interpolación.
        
        NOTA: Si flow_q está fuera del rango de puntos definidos,
        se extrapola (numpy.interp usa valores de borde).
        """
        if flow_q < 0:
            return self.head_points[0]
        
        # Advertir si está fuera del rango (extrapolación)
        if flow_q > self.flow_points[-1]:
            # Extrapolación: usar decaimiento cuadrático aproximado
            # Esto es más realista que mantener el valor plano
            q_max = self.flow_points[-1]
            h_max = self.head_points[-1]
            # Caída proporcional al exceso de caudal
            excess_ratio = (flow_q - q_max) / q_max if q_max > 0 else 0
            return max(0, h_max * (1 - excess_ratio * 0.5))
        
        return np.interp(flow_q, self.flow_points, self.head_points)

    def get_npsh_required(self, flow_q):
        """Retorna el NPSHr para un caudal Q dado."""
        if self.npsh_points is None:
            return 0.0
        return np.interp(flow_q, self.flow_points, self.npsh_points)

    def get_efficiency(self, flow_q):
        """Retorna la eficiencia para un caudal Q dado."""
        if self.eff_points is None:
            # Valor por defecto si no se proporcionan puntos de eficiencia
            return 0.75  # 75%
        return np.interp(flow_q, self.flow_points, self.eff_points)


class PumpPoint(PumpBase):
    """
    Bomba operando a un punto fijo (modo Flujo Fijo).
    No requiere curva completa, solo datos del punto de operación.

    En este modo, el caudal es fijo y el TDH se determina por el sistema.
    """

    def __init__(self, flow, npsh_required, efficiency, nominal_head=None):
        """
        Inicializa bomba a flujo fijo.

        :param flow: Flujo de operación [m3/h]
        :param npsh_required: NPSHr a ese flujo [m]
        :param efficiency: Eficiencia a ese flujo [decimal 0-1]
        :param nominal_head: TDH nominal [m] (opcional, solo para referencia/validación)
        """
        self.flow = flow
        self.npsh_required = npsh_required
        self.efficiency = efficiency  # Ya debe venir en decimal (0-1)
        self.nominal_head = nominal_head

    def get_head(self, flow_q):
        """
        En modo flujo fijo, el TDH es determinado por el sistema, no por la bomba.
        Retorna None para indicar que debe calcularse desde el balance de energías.
        """
        return None  # El sistema debe calcular el head resultante

    def get_npsh_required(self, flow_q):
        """Retorna el NPSHr (constante para este flujo)."""
        return self.npsh_required

    def get_efficiency(self, flow_q):
        """Retorna la eficiencia (constante para este flujo)."""
        return self.efficiency
