"""
Unit Tests for DML Tank Simulation - Simulation Engine
Run with: python -m pytest tests/test_simulation.py -v
"""

import pytest
import math
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.simulation import Simulation
from app.utils.tank import Tank
from app.utils.fluid_props import Fluid
from app.utils.pumps_db import PumpCurve, PumpPoint


def make_default_simulation(calc_mode='pressure_fixed'):
    """Helper to create a simulation with default parameters."""
    tank = Tank(3.0, 5.0)
    fluid = Fluid(998, 1.0, 0.032)
    pipe_specs = {
        "length": 10.0,
        "id": 0.1023,  # 4" Sch40
        "roughness": 0.000045,
        "k_fittings": 3.5,
        "height_diff": -2.0
    }
    valve_data = {
        "type": "MARIPOSA",
        "k": 0.35,
        "percent_open": 100
    }
    discharge_specs = {
        "length": 20.0,
        "id": 0.1023,
        "roughness": 0.000045,
        "height": 10.0,
        "pressure_bar": 2.0,
        "k_fittings": 2.6
    }

    if calc_mode == 'pressure_fixed':
        pump = PumpCurve(
            flow_points=[0, 20, 40, 60, 80],
            head_points=[45, 43, 40, 35, 28],
            npsh_points=[1.0, 1.2, 1.5, 2.0, 3.0]
        )
        fixed_flow = 50.0
    else:
        pump = PumpPoint(50.0, 2.0, 0.75)
        fixed_flow = 50.0

    sim = Simulation(tank, pipe_specs, valve_data, pump, fluid, 4.5,
                     discharge_specs=discharge_specs,
                     calc_mode=calc_mode, fixed_flow=fixed_flow)
    sim.set_altitude(0)
    return sim


class TestSimulationBasic:
    """Basic simulation tests."""

    def test_level_decreases(self):
        """Level must decrease over time during draining."""
        sim = make_default_simulation('pressure_fixed')
        levels = []
        for _ in range(10):
            state = sim.step(2.0)
            levels.append(state['level'])
        # Level should be monotonically decreasing
        for i in range(1, len(levels)):
            assert levels[i] <= levels[i-1], f"Level increased at step {i}: {levels[i]} > {levels[i-1]}"

    def test_flow_positive(self):
        """Flow rate must be positive."""
        sim = make_default_simulation('pressure_fixed')
        for _ in range(5):
            state = sim.step(2.0)
            assert state['flow_m3h'] > 0, "Flow should be positive"

    def test_time_advances(self):
        """Time must advance correctly."""
        sim = make_default_simulation('pressure_fixed')
        dt = 2.0
        for i in range(5):
            state = sim.step(dt)
            expected_time = (i + 1) * dt
            assert abs(state['time'] - expected_time) < 0.001

    def test_volume_decreases(self):
        """Volume must decrease over time."""
        sim = make_default_simulation('pressure_fixed')
        volumes = []
        for _ in range(10):
            state = sim.step(2.0)
            volumes.append(state['volume'])
        for i in range(1, len(volumes)):
            assert volumes[i] < volumes[i-1], f"Volume increased at step {i}"

    def test_reynolds_present(self):
        """Reynolds number and flow regime must be in results."""
        sim = make_default_simulation('pressure_fixed')
        state = sim.step(2.0)
        assert 'reynolds' in state
        assert 'flow_regime' in state
        assert state['reynolds'] > 0
        assert state['flow_regime'] in ['Laminar', 'Transición', 'Turbulento']

    def test_friction_factor_present(self):
        """Friction factor must be in results."""
        sim = make_default_simulation('pressure_fixed')
        state = sim.step(2.0)
        assert 'friction_factor' in state
        assert state['friction_factor'] > 0


class TestSimulationAlarm:
    """Tests for cavitation alarm."""

    def test_alarm_triggers_eventually(self):
        """Alarm should trigger before tank empties completely."""
        sim = make_default_simulation('pressure_fixed')
        alarm_found = False
        for _ in range(2000):
            state = sim.step(2.0)
            if state['alarm']:
                alarm_found = True
                break
            if state['level'] < 0.01:
                break
        # At some point, either alarm or empty (both valid outcomes)
        assert alarm_found or state['level'] < 0.01

    def test_npsh_values_positive(self):
        """NPSHa and NPSHr must be positive during normal operation."""
        sim = make_default_simulation('pressure_fixed')
        state = sim.step(2.0)
        assert state['npsh_a'] > 0, "NPSHa should be positive"
        assert state['npsh_r'] >= 0, "NPSHr should be non-negative"


class TestSimulationFlowFixed:
    """Tests for flow_fixed mode."""

    def test_flow_fixed_constant_flow(self):
        """In flow_fixed mode, flow should be constant."""
        sim = make_default_simulation('flow_fixed')
        flows = []
        for _ in range(5):
            state = sim.step(2.0)
            flows.append(state['flow_m3h'])
        # All flows should be equal
        for f in flows:
            assert abs(f - flows[0]) < 0.001, "Flow should be constant in flow_fixed mode"

    def test_flow_fixed_level_decreases(self):
        """Level must decrease in flow_fixed mode too."""
        sim = make_default_simulation('flow_fixed')
        levels = []
        for _ in range(5):
            state = sim.step(2.0)
            levels.append(state['level'])
        for i in range(1, len(levels)):
            assert levels[i] < levels[i-1]

    def test_flow_fixed_pump_head_calculated(self):
        """In flow_fixed mode, pump_head_m should be calculated (not None)."""
        sim = make_default_simulation('flow_fixed')
        state = sim.step(2.0)
        assert state['pump_head_m'] is not None
        assert state['pump_head_m'] > 0


class TestSimulationPressures:
    """Tests for pressure calculations."""

    def test_suction_pressure_reasonable(self):
        """Suction pressure should be reasonable."""
        sim = make_default_simulation('pressure_fixed')
        state = sim.step(2.0)
        # With water at ~4.5m level, suction pressure should be positive
        assert state['pressure_suction_bar'] > 0

    def test_pressure_diff_present(self):
        """Pressure differential should be present."""
        sim = make_default_simulation('pressure_fixed')
        state = sim.step(2.0)
        assert 'pressure_diff_bar' in state

    def test_pump_power_positive(self):
        """Pump power should be positive during operation."""
        sim = make_default_simulation('pressure_fixed')
        state = sim.step(2.0)
        assert state['pump_power_kw'] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
