"""
Unit Tests for DML Tank Simulation - Fluid Properties
Run with: python -m pytest tests/test_fluid_props.py -v
"""

import pytest
import math
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.fluid_props import Fluid


class TestFluidBasic:
    """Tests for basic Fluid class functionality."""

    def test_default_fluid(self):
        """Test default fluid (water-like) properties."""
        fluid = Fluid()
        assert fluid.rho == 1000
        assert abs(fluid.mu - 0.001) < 0.0001  # 1 cP = 0.001 Pa.s
        assert abs(fluid.pv - 2300) < 100  # 0.023 bar ≈ 2300 Pa

    def test_custom_fluid(self):
        """Test custom fluid properties."""
        fluid = Fluid(density=850, viscosity_cp=5.0, vapor_pressure_bar=0.1)
        assert fluid.rho == 850
        assert abs(fluid.mu - 0.005) < 0.0001  # 5 cP = 0.005 Pa.s
        assert abs(fluid.pv - 10000) < 1  # 0.1 bar = 10000 Pa

    def test_kinematic_viscosity(self):
        """Test kinematic viscosity calculation."""
        fluid = Fluid(1000, 1.0, 0.023)
        nu = fluid.kinematic_viscosity()
        # nu = mu / rho = 0.001 / 1000 = 1e-6 m²/s
        assert abs(nu - 1e-6) < 1e-8


class TestWaterProperties:
    """Tests for water_properties static method."""

    def test_water_at_20c(self):
        """Water at 20°C: density ~998 kg/m³, viscosity ~1 cP."""
        water = Fluid.water_properties(20)
        assert 990 < water.rho < 1005, f"Water density at 20°C: {water.rho}"
        # Viscosity should be around 1 cP = 0.001 Pa.s
        assert 0.0005 < water.mu < 0.002, f"Water viscosity at 20°C: {water.mu} Pa.s"

    def test_water_at_80c(self):
        """Water at 80°C: density ~972 kg/m³, viscosity ~0.35 cP."""
        water = Fluid.water_properties(80)
        assert 960 < water.rho < 985, f"Water density at 80°C: {water.rho}"
        # Viscosity should decrease with temperature
        water_20 = Fluid.water_properties(20)
        assert water.mu < water_20.mu, "Viscosity should decrease with temperature"

    def test_water_vapor_pressure_increases(self):
        """Vapor pressure should increase with temperature."""
        water_20 = Fluid.water_properties(20)
        water_60 = Fluid.water_properties(60)
        water_90 = Fluid.water_properties(90)
        assert water_60.pv > water_20.pv, "Vapor pressure should increase 20→60°C"
        assert water_90.pv > water_60.pv, "Vapor pressure should increase 60→90°C"

    def test_water_density_max_near_4c(self):
        """Water density is maximum near 4°C."""
        water_4 = Fluid.water_properties(4)
        water_20 = Fluid.water_properties(20)
        water_80 = Fluid.water_properties(80)
        assert water_4.rho > water_20.rho, "Density at 4°C > density at 20°C"
        assert water_20.rho > water_80.rho, "Density at 20°C > density at 80°C"


class TestUnitConversions:
    """Tests for unit conversions in Fluid class."""

    def test_viscosity_cp_to_pas(self):
        """Verify cP to Pa.s conversion: 1 cP = 0.001 Pa.s."""
        fluid = Fluid(viscosity_cp=2.5)
        assert abs(fluid.mu - 0.0025) < 1e-7

    def test_vapor_pressure_bar_to_pa(self):
        """Verify bar to Pa conversion: 1 bar = 100000 Pa."""
        fluid = Fluid(vapor_pressure_bar=1.0)
        assert abs(fluid.pv - 100000) < 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
