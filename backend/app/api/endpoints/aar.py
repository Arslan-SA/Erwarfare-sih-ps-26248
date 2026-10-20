# backend/app/api/endpoints/aar.py
"""After Action Review (AAR) endpoints: 4-Quadrant evaluation, dual-timeline reconstruction, and CSV export."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Response

from app.schemas.simulation import (
    AARResultSchema,
    InstructorScores,
    RubricSubmissionRequest,
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
    submission: RubricSubmissionRequest,
) -> AARResultSchema:
    """Submit instructor subjective scoring and recalculate final composite score."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")

    overall = submission.overall_instructor
    if overall is None or overall <= 0:
        overall = ((submission.situational_awareness + submission.risk_management + submission.adaptability) / 15.0) * 100.0

    scores = InstructorScores(
        situational_awareness=submission.situational_awareness,
        risk_management=submission.risk_management,
        adaptability=submission.adaptability,
        overall_instructor=round(overall, 1),
    )
    notes = submission.notes or submission.evaluator_notes or ""
    return AARService.evaluate_session(mgr, instructor_scores=scores, evaluator_notes=notes)


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


@router.get("/export/raw-events")
def export_raw_events_csv(session_id: str) -> Response:
    """Export all raw scenario feeds, telemetry, verifications, and decisions as CSV."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")

    csv_content = AARService.export_raw_events_csv(mgr)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=raw_events_{session_id}.csv"},
    )


@router.get("/export/html", response_class=Response)
@router.get("/export/pdf", response_class=Response)
def export_aar_report_printable(session_id: str) -> Response:
    """Export formal military AAR briefing dossier with embedded vector SVG diagrams and print-to-PDF layout."""
    mgr = session_service.get_session(session_id)
    if not mgr:
        raise HTTPException(status_code=404, detail="Session not found")

    html_content = AARService.generate_html_report(mgr)

    return Response(
        content=html_content,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f"inline; filename=aar_briefing_{session_id}.html"},
    )

