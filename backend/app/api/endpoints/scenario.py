# backend/app/api/endpoints/scenario.py
"""Scenario endpoints: view default, list, and validate/upload custom scenario configs."""

from __future__ import annotations

import yaml
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.engine.scenario_loader import ScenarioLoader
from app.schemas.simulation import ScenarioConfig

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])


@router.get("/default", response_model=ScenarioConfig)
def get_default_scenario() -> ScenarioConfig:
    """Retrieve the standard V1 Malacca Strait tactical scenario."""
    return ScenarioLoader.get_default_scenario()


@router.post("/validate", response_model=ScenarioConfig)
async def validate_scenario_upload(file: UploadFile = File(...)) -> ScenarioConfig:
    """Validate an uploaded YAML/JSON scenario configuration."""
    content = await file.read()
    try:
        raw_dict = yaml.safe_load(content.decode("utf-8"))
        validated = ScenarioConfig(**raw_dict)
        return validated
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid scenario definition: {str(e)}")
