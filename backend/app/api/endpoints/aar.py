# backend/app/api/endpoints/aar.py
"""After Action Review (AAR) endpoints: 4-Quadrant evaluation, dual-timeline reconstruction, and CSV export."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Response

from app.schemas.simulation import (
    AARResultSchema,
    InstructorScores,
)
from app.services.aar_service import AARService
from app.services.session_service import session_service

router = APIRouter(prefix="/sessions/{session_id}/aar", tags=["After Action Review"])


@router.get("", response_model=AARResultSchema)
def get_aar_evaluation(session_id: str) -> AARResultSchema:
    """Generate the comprehensive 4-quadrant evaluation and automated metrics for the session."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")
    return AARService.evaluate_session(mgr)


@router.get("/timeline")
def get_dual_timeline(session_id: str) -> list[dict[str, Any]]:
    """Generate the forensic dual-timeline comparing Ground Truth with Trainee Perceived Truth."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")
    return AARService.generate_dual_timeline(mgr)


@router.post("/rubric", response_model=AARResultSchema)
def submit_instructor_rubric(
    session_id: str,
    scores: InstructorScores,
    notes: Optional[str] = None,
) -> AARResultSchema:
    """Submit instructor subjective scoring and recalculate final composite score."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")
    return AARService.evaluate_session(mgr, instructor_scores=scores, evaluator_notes=notes or "")


@router.get("/export/csv")
def export_aar_csv(session_id: str) -> Response:
    """Export the complete AAR report as a downloadable CSV file."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")

    evaluation = AARService.evaluate_session(mgr)
    csv_content = AARService.export_aar_csv(evaluation)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=aar_report_{session_id}.csv"},
    )
