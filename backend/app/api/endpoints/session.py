# backend/app/api/endpoints/session.py
"""Session management endpoints: session lifecycle, role projections, and clock controls."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.schemas.simulation import (
    ClockControlRequest,
    ClockStatusResponse,
    Role,
)
from app.services.session_service import session_service

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("/create")
def create_session() -> dict[str, Any]:
    """Initialize a new simulation session with the default scenario."""
    mgr = session_service.create_session()
    return {
        "session_id": mgr.session_id,
        "status": mgr.status.value,
        "duration_seconds": mgr.clock.duration_seconds,
        "entities_count": len(mgr.ground_truth_entities),
    }


@router.get("/{session_id}/projection/{role}")
def get_role_projection(session_id: str, role: Role) -> dict[str, Any]:
    """Fetch the asymmetric situational projection tailored for the requested role."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")
    return mgr.get_role_projection(role)


@router.post("/{session_id}/clock", response_model=ClockStatusResponse)
async def control_clock(session_id: str, request: ClockControlRequest) -> ClockStatusResponse:
    """Control the simulation clock (start, pause, resume, step, multiplier)."""
    try:
        return await session_service.control_clock(session_id, request)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")


@router.get("/{session_id}/clock", response_model=ClockStatusResponse)
def get_clock_status(session_id: str) -> ClockStatusResponse:
    """Query current clock time, running status, and multiplier."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")
    return ClockStatusResponse(
        sim_time=mgr.clock.current_sim_time,
        clock_running=mgr.clock.is_running,
        time_multiplier=mgr.clock.time_multiplier,
        session_status=mgr.status,
    )
