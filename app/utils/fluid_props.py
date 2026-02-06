
import math

class Fluid:
    def __init__(self, density=1000, viscosity_cp=1.0, vapor_pressure_bar=0.023):
        """
        :param density: Densidad [kg/m3]
        :param viscosity_cp: Viscosidad dinámica [cP]
        :param vapor_pressure_bar: Presión de vapor [bar] (absoluta)
        """
        self.rho = float(density)
        self.mu = float(viscosity_cp) * 0.001 # Convertir cP a Pa.s (kg/m.s)
        self.pv = float(vapor_pressure_bar) * 100000 # Convertir bar a Pa
        
    def kinematic_viscosity(self):
        """Retorna viscosidad cinemática en m2/s"""
        return self.mu / self.rho

    @staticmethod
    def water_properties(temp_c):
        """
        Retorna objeto Fluid con propiedades del agua a Temp T [°C] aprox.
        Correlaciones simples.
        """
        # Densidad (kg/m3)
        rho = 1000 * (1 - ((temp_c + 288.9414) / (508929.2 * (temp_c + 68.12963))) * (temp_c - 3.9863)**2)
        
        # Viscosidad (cP) - Correlación simple
        mu = 2.414 * 10**(247.8/(temp_c + 133.15)) * 1e-5 * 1000 # Pa.s to cP ?? No, usemos formula simple
        # Vogel equation for viscosity of water: mu = exp(-3.7188 + 578.919 / (T - 137.546)) mPa.s
        mu = math.exp(-3.7188 + 578.919 / ((temp_c + 273.15) - 137.546))
        
        # Presión de vapor (Antoine) mmHg -> Bar
        # log10(P_mmHg) = 8.07131 - 1730.63 / (233.426 + T_C)
        p_mmHg = 10 ** (8.07131 - 1730.63 / (233.426 + temp_c))
        pv_bar = p_mmHg * 0.00133322
        
        return Fluid(rho, mu, pv_bar)
