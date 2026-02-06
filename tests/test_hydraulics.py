"""
Unit Tests for DML Tank Simulation - Hydraulic Calculations
Run with: python -m pytest tests/test_hydraulics.py -v
"""

import pytest
import math
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.hydraulics import (
    calculate_velocity,
    calculate_reynolds,
    calculate_friction_factor,
    calculate_head_loss_pipe,
    calculate_head_loss_fittings,
    calculate_cv,
    g
)
from app.utils.tank import Tank
from app.utils.fluid_props import Fluid
from app.utils.valves_db import get_valve_k
from app.utils.pumps_db import PumpCurve


class TestVelocityCalculations:
    """Tests for velocity calculation function."""
    
    def test_velocity_basic(self):
        """Test basic velocity calculation: Q=36 m³/h, A=0.01 m² → v=1 m/s"""
        flow_m3h = 36.0  # 36 m³/h = 0.01 m³/s
        area = 0.01  # m²
        velocity = calculate_velocity(flow_m3h, area)
        assert abs(velocity - 1.0) < 0.001, f"Expected 1.0 m/s, got {velocity}"
    
    def test_velocity_zero_area(self):
        """Test that zero area returns zero velocity (no crash)."""
        velocity = calculate_velocity(100, 0)
        assert velocity == 0.0
    
    def test_velocity_4inch_pipe(self):
        """Test velocity in 4 inch pipe at 50 m³/h."""
        # 4" Sch40 ID ≈ 0.1023 m
        d = 0.1023
        area = math.pi * (d/2)**2
        flow = 50.0  # m³/h
        velocity = calculate_velocity(flow, area)
        # Expected: 50/3600 / (π × 0.0512²) ≈ 1.69 m/s
        assert 1.6 < velocity < 1.8, f"Velocity {velocity} m/s out of expected range"


class TestReynoldsNumber:
    """Tests for Reynolds number calculation."""
    
    def test_reynolds_water(self):
        """Test Re for water at typical conditions."""
        rho = 1000  # kg/m³
        v = 2.0  # m/s
        d = 0.1  # m
        mu = 0.001  # Pa.s (water at 20°C)
        re = calculate_reynolds(rho, v, d, mu)
        # Re = 1000 × 2 × 0.1 / 0.001 = 200,000
        assert abs(re - 200000) < 100


class TestFrictionFactor:
    """Tests for friction factor calculation."""
    
    def test_laminar_flow(self):
        """Test friction factor in laminar regime."""
        re = 1000
        f = calculate_friction_factor(re, 0.00005, 0.1)
        expected = 64 / 1000  # f = 64/Re for laminar
        assert abs(f - expected) < 0.001
    
    def test_zero_reynolds(self):
        """Test that Re=0 returns high friction factor (no crash)."""
        f = calculate_friction_factor(0, 0.00005, 0.1)
        assert f == 640.0, f"Expected 640.0 for Re=0, got {f}"
    
    def test_turbulent_flow(self):
        """Test friction factor in turbulent regime."""
        re = 100000
        roughness = 0.00005  # Steel
        diameter = 0.1
        f = calculate_friction_factor(re, roughness, diameter)
        # Should be around 0.018-0.022 for this case
        assert 0.015 < f < 0.025, f"Friction factor {f} out of expected range"
    
    def test_transition_zone(self):
        """Test friction factor in transition zone (2300 < Re < 4000)."""
        f = calculate_friction_factor(3000, 0.00005, 0.1)
        # Should be interpolated between laminar and turbulent
        f_lam = 64 / 2300
        assert f > f_lam * 0.5, "Transition f should be between laminar and turbulent"


class TestTank:
    """Tests for Tank class."""
    
    def test_tank_total_volume(self):
        """Test that total volume is calculated correctly."""
        tank = Tank(3.0, 5.0)  # D=3m, H=5m
        # V_cyl = π × 1.5² × 5 ≈ 35.34 m³
        # V_head ≈ 0.0847 × 3³ = 2.29 m³ each
        expected_total = 35.34 + 2 * 2.29
        assert abs(tank.vol_total - expected_total) < 0.5
    
    def test_tank_level_from_volume(self):
        """Test volume-to-level inverse calculation."""
        tank = Tank(3.0, 5.0)
        # At half the total volume, level should be approximately half height
        half_vol = tank.vol_total / 2
        level = tank.get_level_from_volume(half_vol)
        # Should be roughly in the cylinder section
        assert level > tank.h_head, "Half volume should be above bottom head"
    
    def test_tank_symmetry(self):
        """Test that volume calculation is reversible."""
        tank = Tank(3.0, 5.0)
        test_level = 3.5
        vol = tank.get_volume_from_level(test_level)
        level_back = tank.get_level_from_volume(vol)
        assert abs(level_back - test_level) < 0.001


class TestValveCurves:
    """Tests for valve characteristic curves."""
    
    def test_valve_full_open(self):
        """Test that full open (100%) returns base K."""
        k = get_valve_k("MARIPOSA", 100)
        assert k == 0.35  # Base K for butterfly
    
    def test_valve_closed(self):
        """Test that nearly closed returns very high K."""
        k = get_valve_k("MARIPOSA", 1)
        assert k > 1e6
    
    def test_valve_progressive(self):
        """Test that K increases as valve closes."""
        k_75 = get_valve_k("BOLA", 75)
        k_50 = get_valve_k("BOLA", 50)
        k_25 = get_valve_k("BOLA", 25)
        assert k_25 > k_50 > k_75, "K should increase as valve closes"


class TestPumpCurve:
    """Tests for pump curve interpolation."""
    
    def test_pump_interpolation(self):
        """Test pump head interpolation."""
        pump = PumpCurve(
            flow_points=[0, 20, 40, 60, 80],
            head_points=[60, 58, 55, 50, 42]
        )
        # At Q=40, should get TDH=55
        h = pump.get_head(40)
        assert abs(h - 55) < 0.1
    
    def test_pump_extrapolation(self):
        """Test pump extrapolation beyond curve."""
        pump = PumpCurve(
            flow_points=[0, 20, 40, 60, 80],
            head_points=[60, 58, 55, 50, 42]
        )
        # At Q=100 (beyond curve), should get reduced head
        h = pump.get_head(100)
        assert h < 42, f"Extrapolated head {h} should be less than last point"


class TestCvCalculation:
    """Tests for Cv calculation."""
    
    def test_cv_basic(self):
        """Test basic Cv calculation."""
        # Q=50 m³/h, ΔP=1 bar, SG=1
        cv = calculate_cv(50, 1.0, 1.0)
        # Cv = 50 × 4.40287 × sqrt(1/14.5038) ≈ 57.8
        assert 55 < cv < 60, f"Cv {cv} out of expected range"
    
    def test_cv_zero_dp(self):
        """Test Cv with zero pressure drop."""
        cv = calculate_cv(50, 0, 1.0)
        assert cv == 0.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
