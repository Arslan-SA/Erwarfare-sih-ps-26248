# backend/app/api/endpoints/instructor.py
"""Instructor closed-loop control console endpoints for dynamic tactical injections."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException

from app.schemas.simulation import (
    DegradationType,
    EntityDomain,
    FeedMessageSchema,
    InstructorInjection,
    Role,
)
from app.services.session_service import session_service
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/sessions/{session_id}/instructor", tags=["Instructor Console"])


@router.get("/state")
def get_omniscient_state(session_id: str) -> dict[str, Any]:
    """Return complete ground truth state and all subsystem projections for the Instructor."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")
    return mgr.get_role_projection(Role.INSTRUCTOR)


@router.post("/ew-intensity")
async def set_ew_intensity(session_id: str, intensity: int = Body(..., embed=True, ge=0, le=100)) -> dict[str, Any]:
    """Adjust the global Electronic Warfare intensity slider."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")

    mgr.ew_engine.set_global_intensity(intensity)

    # Broadcast update
    await ws_manager.broadcast_session_event(session_id, {
        "type": "EW_UPDATE",
        "intensity": intensity,
    })

    return {"status": "SUCCESS", "new_intensity": intensity}


@router.post("/sever-comms")
async def toggle_comms_link(
    session_id: str,
    role_a: str = Body(..., embed=True),
    role_b: str = Body(..., embed=True),
    sever: bool = Body(..., embed=True),
) -> dict[str, Any]:
    """Sever or restore a communication channel between two tactical units."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")

    if sever:
        mgr.ew_engine.sever_link(role_a, role_b)
    else:
        mgr.ew_engine.restore_link(role_a, role_b)

    await ws_manager.broadcast_session_event(session_id, {
        "type": "COMMS_LINK_STATE",
        "link": [role_a, role_b],
        "severed": sever,
    })

    return {"status": "SUCCESS", "link": [role_a, role_b], "severed": sever}


@router.post("/inject")
async def inject_event(session_id: str, injection: InstructorInjection) -> dict[str, Any]:
    """Execute dynamic real-time instructor injection (spoof contact, conflict injection, alert)."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")

    inj_type = injection.injection_type

    if inj_type == "INJECT_CONFLICT":
        # Inject conflicting sensor report
        msg = FeedMessageSchema(
            id=f"INJ-SPOOF-{mgr.clock.current_sim_time}",
            sim_timestamp=mgr.clock.current_sim_time,
            source_unit=injection.target_unit or "SIGINT",
            target_role=Role.COMMANDER,
            domain=EntityDomain.SEA,
            title="[INJECTED] Ambiguous Target Bearing",
            content=injection.payload.get("content", "Adversary decoy emission detected on bearing 090."),
            degradation_type=DegradationType.CONFLICTING,
            divergence_variant="SPOOF_INJECTED",
        )
        mgr.all_feed_messages.append(msg)
        await ws_manager.send_to_role(session_id, Role.COMMANDER, {
            "type": "NEW_FEED",
            "message": msg.model_dump(),
        })

    elif inj_type in ("SET_EW_INTENSITY", "EW_OVERRIDE"):
        intensity = injection.payload.get("intensity", 80)
        mgr.ew_engine.set_global_intensity(intensity)

    elif inj_type == "SEVER_COMMS":
        r1 = injection.payload.get("role_a", "COMMANDER")
        r2 = injection.payload.get("role_b", "UNIT_B")
        mgr.ew_engine.sever_link(r1, r2)

    return {"status": "INJECTED", "injection_type": inj_type}
