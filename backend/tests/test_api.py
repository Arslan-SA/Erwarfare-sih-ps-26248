# backend/tests/test_api.py
"""Integration tests for FastAPI REST endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_check() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "HEALTHY"


@pytest.mark.asyncio
async def test_get_default_scenario() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/scenarios/default")
        assert response.status_code == 200
        data = response.json()
        assert "scenario_id" in data
        assert len(data["initial_entities"]) >= 2


@pytest.mark.asyncio
async def test_session_lifecycle_and_decision() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create session
        res = await ac.post("/api/sessions/create")
        assert res.status_code == 200
        session_id = res.json()["session_id"]

        # Check clock status
        clk_res = await ac.get(f"/api/sessions/{session_id}/clock")
        assert clk_res.status_code == 200
        assert clk_res.json()["sim_time"] == 0

        # Step clock forward 1 second
        step_res = await ac.post(f"/api/sessions/{session_id}/clock", json={"action": "step"})
        assert step_res.status_code == 200
        assert step_res.json()["sim_time"] == 1

        # Submit decision
        dec_payload = {
            "sim_timestamp": 1,
            "role": "COMMANDER",
            "action": "HOLD_VERIFY",
            "target_entity_id": "TRK-002",
            "confidence_score": 85,
            "rationale": "Holding fire to verify civilian AIS broadcast under high EW interference.",
            "assumed_risk": "Short delay in weapons readiness.",
            "evidence_message_ids": [],
        }
        dec_res = await ac.post(f"/api/sessions/{session_id}/decisions", json=dec_payload)
        assert dec_res.status_code == 200
        assert "id" in dec_res.json()

        # Generate AAR
        aar_res = await ac.get(f"/api/sessions/{session_id}/aar")
        assert aar_res.status_code == 200
        aar_data = aar_res.json()
        assert aar_data["classification"] in ("OPTIMAL", "DEFENSIBLE", "LUCKY_GUESS", "CRITICAL_FAILURE")
        assert "automated_scores" in aar_data

        # Export CSV
        csv_res = await ac.get(f"/api/sessions/{session_id}/aar/export/csv")
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers["content-type"]
