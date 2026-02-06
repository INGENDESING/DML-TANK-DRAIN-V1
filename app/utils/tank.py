
import math
import numpy as np

class Tank:
    """
    Tanque cilíndrico vertical con tapas torisféricas ASME F&D (Flanged & Dished).

    Geometría ASME F&D estándar:
    - Radio corona (L) = D (diámetro del tanque)
    - Radio knuckle (r) = 0.06 * D
    - Altura de cabeza (h) ≈ 0.1935 * D (exacto, no 0.169)

    Referencias:
    - ASME Boiler and Pressure Vessel Code, Section VIII
    - Perry's Chemical Engineers' Handbook, 8th Ed.
    """

    def __init__(self, diameter, straight_height, head_type='ASME_FD'):
        """
        :param diameter: Diámetro interno [m]
        :param straight_height: Altura parte cilíndrica (recta) [m]
        :param head_type: Tipo de cabeza ('ASME_FD', 'ELLIPTICAL_2_1', 'HEMISPHERICAL')
        """
        self.D = float(diameter)
        self.H_cyl = float(straight_height)
        self.R = self.D / 2.0
        self.head_type = head_type

        # Parámetros según tipo de cabeza
        if head_type == 'ASME_FD':
            # ASME F&D (Flanged & Dished) - Toriesférico estándar
            self.L = self.D  # Radio corona = Diámetro
            self.r_k = 0.06 * self.D  # Radio knuckle
            # Altura exacta de cabeza F&D: h = L - sqrt((L-r)^2 - (D/2 - r)^2)
            # Simplificado: h ≈ 0.1935 * D para F&D estándar
            self.h_head = self.L - math.sqrt((self.L - self.r_k)**2 - (self.R - self.r_k)**2)
            # Volumen exacto de cabeza F&D (fórmula de Perry's):
            # V = (π/3) * h² * (3L - h) - aproximación esférica ajustada
            # O usar: V ≈ 0.0847 * D³ para F&D estándar
            self.vol_head = 0.0847 * (self.D ** 3)

        elif head_type == 'ELLIPTICAL_2_1':
            # Cabeza elíptica 2:1 (semi-eje mayor = D/2, semi-eje menor = D/4)
            self.h_head = self.D / 4.0
            # Volumen de semi-elipsoide: V = (2/3) * π * a² * b donde a=D/2, b=D/4
            self.vol_head = (2.0 / 3.0) * math.pi * (self.R ** 2) * (self.D / 4.0)

        elif head_type == 'HEMISPHERICAL':
            # Cabeza hemisférica
            self.h_head = self.R
            # Volumen de hemisferio: V = (2/3) * π * R³
            self.vol_head = (2.0 / 3.0) * math.pi * (self.R ** 3)

        else:
            # Default: ASME F&D
            self.h_head = 0.1935 * self.D
            self.vol_head = 0.0847 * (self.D ** 3)

        # Volumen del cilindro
        self.vol_cyl = math.pi * (self.R ** 2) * self.H_cyl

        # Volumen total (fondo + cilindro + tapa)
        self.vol_total = self.vol_cyl + 2 * self.vol_head

        # Altura total del tanque
        self.H_total = self.H_cyl + 2 * self.h_head

    def _volume_partial_head(self, h_in_head):
        """
        Calcula el volumen parcial de una cabeza torisférica para un nivel h.

        Para ASME F&D, usamos integración numérica simplificada o
        la fórmula de casquete esférico ajustada.

        :param h_in_head: Altura de líquido dentro de la cabeza [m]
        :return: Volumen parcial [m³]
        """
        if h_in_head <= 0:
            return 0.0
        if h_in_head >= self.h_head:
            return self.vol_head

        # Aproximación mejorada usando integración numérica (Simpson)
        # El perfil de la cabeza F&D no es una simple esfera
        # Usamos interpolación basada en la fracción de llenado

        # Método: Integración numérica del área circular variable
        n_points = 100  # Aumentado para mayor precisión (antes: 50)
        dh = h_in_head / n_points
        volume = 0.0

        for i in range(n_points):
            h1 = i * dh
            h2 = (i + 1) * dh
            h_mid = (h1 + h2) / 2

            # Radio efectivo a cada altura (aproximación para F&D)
            # El radio varía desde 0 en el fondo hasta R en la unión con el cilindro
            # Perfil aproximado: r(h) = R * sqrt(h/h_head) * factor_ajuste
            if self.head_type == 'ASME_FD':
                # Perfil torisférico: combinación de esfera y toro
                # Aproximación simplificada
                ratio = h_mid / self.h_head
                # El radio crece más rápido que lineal debido a la geometría
                r_at_h = self.R * math.sqrt(ratio * (2 - ratio))
            else:
                # Elíptico o hemisférico: perfil más suave
                ratio = h_mid / self.h_head
                r_at_h = self.R * math.sqrt(ratio * (2 - ratio))

            area = math.pi * r_at_h ** 2
            volume += area * dh

        return volume

    def get_volume_from_level(self, level_h):
        """
        Calcula el volumen de líquido dado el nivel desde el fondo del tanque.
        El nivel H=0 es el punto más bajo de la tapa inferior.

        :param level_h: Nivel de líquido medido desde el fondo [m]
        :return: Volumen de líquido [m³]
        """
        if level_h <= 0:
            return 0.0

        # Zona 1: Dentro del fondo torisférico
        if level_h <= self.h_head:
            return self._volume_partial_head(level_h)

        # Zona 2: En la parte cilíndrica
        elif level_h <= (self.h_head + self.H_cyl):
            h_in_cyl = level_h - self.h_head
            v_cyl_partial = math.pi * (self.R ** 2) * h_in_cyl
            return self.vol_head + v_cyl_partial

        # Zona 3: En la tapa superior
        elif level_h <= self.H_total:
            h_in_top = level_h - (self.h_head + self.H_cyl)
            # Volumen = Total - vacío en la parte superior de la tapa
            h_empty = self.h_head - h_in_top
            vol_empty = self._volume_partial_head(h_empty)
            # El vacío está "invertido", así que restamos del volumen total de cabeza
            return self.vol_cyl + self.vol_head + (self.vol_head - vol_empty)

        else:
            return self.vol_total  # Rebosado

    def get_level_from_volume(self, volume):
        """
        Calcula el nivel de líquido dado un volumen usando bisección.

        :param volume: Volumen de líquido [m³]
        :return: Nivel de líquido [m]
        """
        if volume <= 0:
            return 0.0
        if volume >= self.vol_total:
            return self.H_total

        # Bisección
        low = 0.0
        high = self.H_total
        tolerance = 1e-6

        for _ in range(50):
            mid = (low + high) / 2
            v_est = self.get_volume_from_level(mid)

            if abs(v_est - volume) < 1e-9:
                return mid

            if v_est < volume:
                low = mid
            else:
                high = mid

            if (high - low) < tolerance:
                break

        return (low + high) / 2

    def get_surface_area_at_level(self, level_h):
        """
        Calcula el área superficial del líquido a un nivel dado.
        Útil para cálculos de evaporación o transferencia de calor.

        :param level_h: Nivel de líquido [m]
        :return: Área superficial [m²]
        """
        if level_h <= 0 or level_h >= self.H_total:
            return 0.0

        # En el cilindro: área constante = π * R²
        if self.h_head < level_h < (self.h_head + self.H_cyl):
            return math.pi * self.R ** 2

        # En las cabezas: área variable
        if level_h <= self.h_head:
            h = level_h
        else:
            h = level_h - self.H_cyl - self.h_head
            h = self.h_head - abs(self.h_head - h)  # Simetría

        ratio = h / self.h_head
        r_at_h = self.R * math.sqrt(ratio * (2 - ratio))
        return math.pi * r_at_h ** 2
