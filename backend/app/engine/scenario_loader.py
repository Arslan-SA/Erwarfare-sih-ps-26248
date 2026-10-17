# backend/app/engine/scenario_loader.py
"""Scenario parser and validator for YAML / JSON definitions."""

from __future__ import annotations

import pathlib
from typing import Any

import yaml

from app.core.logging import get_logger
from app.schemas.simulation import ScenarioConfig

logger = get_logger(__name__)

SCENARIOS_DIR = pathlib.Path(__file__).parent.parent.parent / "scenarios"


class ScenarioLoader:
    """Loads and validates tactical simulation scenario files."""

    @staticmethod
    def load_from_yaml_file(file_path: pathlib.Path | str) -> ScenarioConfig:
        """Parse and validate a scenario from a YAML file."""
        path = pathlib.Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Scenario file not found: {path}")

        with open(path, "r", encoding="utf-8") as f:
            raw_data = yaml.safe_load(f)

        config = ScenarioConfig(**raw_data)
        logger.info("Scenario loaded successfully", scenario_id=config.scenario_id, name=config.name)
        return config

    @staticmethod
    def get_default_scenario() -> ScenarioConfig:
        """Return the default V1 Malacca Strait scenario."""
        default_path = SCENARIOS_DIR / "scenario_v1_malacca.yaml"
        if default_path.exists():
            return ScenarioLoader.load_from_yaml_file(default_path)

        # Fallback inline config if file not found
        fallback_dict: dict[str, Any] = {
            "scenario_id": "SCEN-DEFAULT-001",
            "name": "Strait of Malacca Littoral Defense",
            "tactical_context": "High-density maritime traffic choke point under active adversary electronic warfare jamming.",
            "difficulty": "MEDIUM",
            "simulated_duration_seconds": 420,
            "roles": ["COMMANDER", "UNIT_A", "UNIT_B", "INSTRUCTOR"],
            "initial_entities": [
                {
                    "id": "TRK-001",
                    "name": "INS Kora (FPV-Bravo)",
                    "domain": "SEA",
                    "classification": "FRIENDLY",
                    "x": 32.0,
                    "y": 65.0,
                    "speed_knots": 18.0,
                    "heading_deg": 45.0,
                    "status": "ACTIVE",
                    "observed_by_roles": ["COMMANDER", "UNIT_A", "UNIT_B"],
                },
                {
                    "id": "TRK-002",
                    "name": "Unknown Surface Contact",
                    "domain": "SEA",
                    "classification": "AMBIGUOUS",
                    "x": 58.0,
                    "y": 42.0,
                    "speed_knots": 14.0,
                    "heading_deg": 290.0,
                    "status": "ACTIVE",
                    "observed_by_roles": ["COMMANDER", "UNIT_A", "UNIT_B"],
                },
            ],
            "timeline_events": [],
            "degradation_schedule": [],
        }
        return ScenarioConfig(**fallback_dict)
