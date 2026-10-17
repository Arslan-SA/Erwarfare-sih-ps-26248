# backend/app/api/endpoints/decision.py
"""Decision and Cross-Verification endpoints for trainees."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.schemas.simulation import (
    Role,
    TraineeDecisionCreate,
    TraineeDecisionSchema,
    VerificationRequestCreate,
    VerificationRequestSchema,
)
from app.services.session_service import session_service

router = APIRouter(prefix="/sessions/{session_id}", tags=["Decisions & Verifications"])


@router.post("/decisions", response_model=TraineeDecisionSchema)
async def submit_decision(session_id: str, decision: TraineeDecisionCreate) -> TraineeDecisionSchema:
    """Submit a structured trainee decision, capturing rationale, confidence, and assumed risk."""
    try:
        return await session_service.submit_decision(session_id, decision)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")


@router.get("/decisions", response_model=list[TraineeDecisionSchema])
def list_decisions(session_id: str) -> list[TraineeDecisionSchema]:
    """Retrieve all decisions submitted during the session."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")
    return mgr.trainee_decisions


@router.post("/verifications", response_model=VerificationRequestSchema)
async def submit_verification(
    session_id: str,
    request: VerificationRequestCreate,
    from_role: Role = Query(default=Role.COMMANDER),
) -> VerificationRequestSchema:
    """Submit a cross-examination verification inquiry to another tactical role."""
    try:
        return await session_service.submit_verification(session_id, request, from_role)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")


@router.get("/verifications", response_model=list[VerificationRequestSchema])
def list_verifications(session_id: str) -> list[VerificationRequestSchema]:
    """Retrieve all cross-examination verification queries."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")
    return mgr.verification_requests
