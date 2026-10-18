# backend/tests/test_auth.py
"""Unit and integration tests for Operator Authentication and RBAC."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_commander_login_success() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/auth/login",
            json={
                "service_id": "NAV-8821",
                "call_sign": "CDR. A. VERMA",
                "role": "COMMANDER",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "AUTHENTICATED"
        assert data["user"]["role"] == "COMMANDER"
        assert "token" in data["user"]
        assert "LEVEL 4" in data["user"]["clearance_level"]


@pytest.mark.asyncio
async def test_instructor_login_requires_passcode() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Missing or invalid passcode -> 401 Unauthorized
        res_fail = await ac.post(
            "/api/auth/login",
            json={
                "service_id": "INST-ROOT",
                "call_sign": "CHIEF EVALUATOR",
                "role": "INSTRUCTOR",
                "passcode": "wrong_password",
            },
        )
        assert res_fail.status_code == 401
        assert "Access Denied" in res_fail.json()["detail"]

        # 2. Correct passcode -> 200 OK
        res_ok = await ac.post(
            "/api/auth/login",
            json={
                "service_id": "INST-ROOT",
                "call_sign": "CHIEF EVALUATOR",
                "role": "INSTRUCTOR",
                "passcode": "DEFENSE-C4I-LEAD",
            },
        )
        assert res_ok.status_code == 200
        assert res_ok.json()["user"]["role"] == "INSTRUCTOR"
        assert "LEVEL 5" in res_ok.json()["user"]["clearance_level"]


@pytest.mark.asyncio
async def test_get_current_operator_me() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        login_res = await ac.post(
            "/api/auth/login",
            json={
                "service_id": "AIR-101",
                "call_sign": "LT. S. NAIR",
                "role": "UNIT_A",
            },
        )
        token = login_res.json()["user"]["token"]

        me_res = await ac.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        assert me_res.json()["call_sign"] == "LT. S. NAIR"
        assert me_res.json()["role"] == "UNIT_A"
