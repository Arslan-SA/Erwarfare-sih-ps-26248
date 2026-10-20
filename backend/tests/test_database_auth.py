# backend/tests/test_database_auth.py
"""Test suite for database stabilization, account seeding, and role-based login."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.core.database import db_manager


@pytest.mark.asyncio
async def test_database_initialization_and_status():
    """Verify database auto-initialization and health status introspection."""
    await db_manager.initialize()
    status = await db_manager.get_status()
    assert status["status"] == "HEALTHY"
    assert status["database_type"] in ("SQLITE", "SUPABASE_POSTGRESQL", "POSTGRESQL")
    assert status["tables_registered"] >= 10
    assert status["registered_accounts"] >= 4


@pytest.mark.asyncio
async def test_accounts_directory_endpoint():
    """Verify GET /api/auth/accounts returns operational station credentials."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/auth/accounts")
        assert res.status_code == 200
        accounts = res.json()
        assert len(accounts) >= 4

        roles = {a["role"] for a in accounts}
        assert "COMMANDER" in roles
        assert "UNIT_A" in roles
        assert "UNIT_B" in roles
        assert "INSTRUCTOR" in roles


@pytest.mark.asyncio
async def test_login_for_each_operational_role():
    """Verify dedicated login credentials for all four duty stations."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        STATIONS = [
            {
                "service_id": "CDR-NAV-8821",
                "role": "COMMANDER",
                "password": "COMMANDER-2026",
            },
            {
                "service_id": "FAD-AIR-4012",
                "role": "UNIT_A",
                "password": "UNIT-A-2026",
            },
            {
                "service_id": "ESM-SEA-7109",
                "role": "UNIT_B",
                "password": "UNIT-B-2026",
            },
            {
                "service_id": "INST-CTRL-001",
                "role": "INSTRUCTOR",
                "passcode": "DEFENSE-C4I-LEAD",
            },
        ]

        for station in STATIONS:
            res = await ac.post("/api/auth/login", json=station)
            assert res.status_code == 200, f"Failed for {station['role']}: {res.text}"
            data = res.json()
            assert data["status"] == "AUTHENTICATED"
            assert data["user"]["role"] == station["role"]
            assert data["user"]["service_id"] == station["service_id"]
            assert len(data["user"]["token"]) > 20


@pytest.mark.asyncio
async def test_database_status_endpoint():
    """Verify GET /api/system/database-status responds with active engine details."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/system/database-status")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "HEALTHY"
        assert "database_type" in data
        assert "registered_accounts" in data
