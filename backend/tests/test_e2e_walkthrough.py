# backend/tests/test_e2e_walkthrough.py
"""End-to-End Walkthrough Integration Test (Fragments 225 & 226).

Simulates the complete blueprint operational lifecycle (T=0 to T=7 and full scenario):
- T=0: Instructor starts exercise with default scenario
- T=1: Authoritative sensor report generated
- T=2: EW jamming surge begins
- T=3: Asymmetric feeds dispatched (Unit A radar vs Unit B AIS)
- T=4: Commander detects sensor discrepancy and transmits verification cross-examination
- T=5: Commander submits structured decision + military rationale; forensic snapshot frozen
- T=6: EW conditions normalize
- T=7: Exercise completes; AAR engine evaluates 4-quadrant defensible decision
- Validates High Score award for Defensible Decision under uncertainty
- Validates formal HTML/PDF and raw event CSV exports
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.simulation import (
    DecisionClassification,
    Role,
    TacticalAction,
    TraineeDecisionCreate,
    VerificationRequestCreate,
)
from app.services.aar_service import AARService
from app.services.session_service import session_service


@pytest.mark.asyncio
async def test_complete_blueprint_lifecycle_walkthrough() -> None:
    """Full architectural integration test simulating blueprint scenario timeline."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # -------------------------------------------------------------
        # T=0: Instructor creates and starts simulation session
        # -------------------------------------------------------------
        res_create = await ac.post("/api/sessions/create")
        assert res_create.status_code == 200
        session_id = res_create.json()["session_id"]
        mgr = session_service.get_session(session_id)
        assert mgr is not None

        # Verify initial state has 4 ground truth entities
        assert len(mgr.ground_truth_entities) >= 4

        # -------------------------------------------------------------
        # T=1: Advance clock -> Initial maritime intelligence summary
        # -------------------------------------------------------------
        await ac.post(f"/api/sessions/{session_id}/clock", json={"action": "step"})
        assert mgr.clock.current_sim_time == 1

        # -------------------------------------------------------------
        # T=2: Instructor or scenario initiates EW jamming surge
        # -------------------------------------------------------------
        res_inject = await ac.post(
            f"/api/sessions/{session_id}/instructor/inject",
            json={
                "injection_type": "EW_OVERRIDE",
                "payload": {"intensity": 90},
            },
        )
        assert res_inject.status_code == 200
        assert mgr.ew_engine.global_ew_intensity == 90

        # -------------------------------------------------------------
        # T=3: Asymmetric Feed Dispatched -> Commander and Units observe partitioned feeds
        # -------------------------------------------------------------
        cmdr_proj = mgr.get_role_projection(Role.COMMANDER)
        unit_a_proj = mgr.get_role_projection(Role.UNIT_A)
        unit_b_proj = mgr.get_role_projection(Role.UNIT_B)

        assert "entities" in cmdr_proj
        assert "feeds" in unit_a_proj
        assert "feeds" in unit_b_proj

        # -------------------------------------------------------------
        # T=4: Commander notices conflict on TRK-002, submits verification to Unit B
        # -------------------------------------------------------------
        verify_req = VerificationRequestCreate(
            target_entity_id="TRK-002",
            query="Verify radar cross section against civilian AIS database.",
            to_role=Role.UNIT_B,
        )
        res_verif = await ac.post(
            f"/api/sessions/{session_id}/verifications",
            params={"from_role": "COMMANDER"},
            json=verify_req.model_dump(),
        )
        assert res_verif.status_code == 200
        assert len(mgr.verification_requests) >= 1
        assert mgr.verification_requests[0].target_entity_id == "TRK-002"

        # -------------------------------------------------------------
        # T=5: Commander submits structured decision + defensive rationale
        # -------------------------------------------------------------
        decision_payload = TraineeDecisionCreate(
            sim_timestamp=140,
            role=Role.COMMANDER,
            action=TacticalAction.HOLD_VERIFY,
            target_entity_id="TRK-002",
            confidence_score=85,
            rationale="Sensor discrepancy identified on TRK-002. Unit A radar indicates combatant while Unit B receives civilian AIS transponder. Holding weapons release to prevent civil fratricide under active adversary jamming.",
            assumed_risk="Allowing contact to close to 15nm increases risk of engagement delay, but prevents catastrophic civil collateral damage.",
            evidence_message_ids=["MSG-10-INTEL", "MSG-60-RADAR"],
        )
        res_dec = await ac.post(
            f"/api/sessions/{session_id}/decisions",
            json=decision_payload.model_dump(),
        )
        assert res_dec.status_code == 200

        # Ensure forensic snapshot at T=decision was captured
        snapshots = mgr.forensic_snapshots
        decision_moments = [s for s in snapshots if s.get("snapshot_type") == "DECISION_MOMENT"]
        assert len(decision_moments) >= 1
        assert decision_moments[0]["sim_timestamp"] == 140

        # -------------------------------------------------------------
        # T=6: EW conditions normalized
        # -------------------------------------------------------------
        mgr.ew_engine.set_global_intensity(10)
        assert mgr.ew_engine.global_ew_intensity == 10

        # -------------------------------------------------------------
        # T=7: Exercise completes -> AAR Evaluation computed
        # -------------------------------------------------------------
        res_aar = await ac.get(f"/api/sessions/{session_id}/aar")
        assert res_aar.status_code == 200
        aar = res_aar.json()

        # Fragment 226: Verify that automated scoring properly awards High Score
        # for Defensible / Optimal Decision under uncertainty!
        assert aar["classification"] in (
            DecisionClassification.DEFENSIBLE.value,
            DecisionClassification.OPTIMAL.value,
        )
        assert aar["reasoning_quality"] == "GOOD"
        assert aar["automated_scores"]["verification_score"] >= 75.0
        assert aar["automated_scores"]["information_sharing_score"] >= 70.0
        assert aar["final_composite_score"] >= 70.0

        # -------------------------------------------------------------
        # Verify Dual-Timeline Reconstruction API
        # -------------------------------------------------------------
        res_timeline = await ac.get(f"/api/sessions/{session_id}/aar/timeline")
        assert res_timeline.status_code == 200
        timeline_data = res_timeline.json()
        assert len(timeline_data) >= 1

        # -------------------------------------------------------------
        # Verify CSV Summaries and Raw Event Logs Exports
        # -------------------------------------------------------------
        res_csv = await ac.get(f"/api/sessions/{session_id}/aar/export/csv")
        assert res_csv.status_code == 200
        assert "SIH26248 AFTER ACTION REVIEW (AAR) REPORT" in res_csv.text

        res_raw_csv = await ac.get(f"/api/sessions/{session_id}/aar/export/raw-events")
        assert res_raw_csv.status_code == 200
        assert "TRAINEE_DECISION" in res_raw_csv.text
        assert "VERIFICATION_CROSS_CHECK" in res_raw_csv.text

        # -------------------------------------------------------------
        # Verify HTML/PDF Printable Dossier Export
        # -------------------------------------------------------------
        res_html = await ac.get(f"/api/sessions/{session_id}/aar/export/html")
        assert res_html.status_code == 200
        assert "Forensic After Action Review (AAR) Dossier" in res_html.text
        assert "svg" in res_html.text.lower()
        assert "TRK-002" in res_html.text


@pytest.mark.asyncio
async def test_lucky_guess_is_strictly_penalized() -> None:
    """Proves doctrinal tenet: lucky guess with poor reasoning gets low score regardless of outcome."""
    mgr = session_service.create_session()

    # Trainee guesses blindly with zero verification and trivial rationale
    decision = TraineeDecisionCreate(
        sim_timestamp=130,
        role=Role.COMMANDER,
        action=TacticalAction.HOLD_VERIFY,
        target_entity_id="TRK-002",
        confidence_score=100,
        rationale="Lucky hunch.",  # < 20 chars, no verifications
        assumed_risk="",
        evidence_message_ids=[],
    )
    mgr.submit_decision(decision)

    aar = AARService.evaluate_session(mgr)
    assert aar.reasoning_quality == "POOR"
    assert aar.classification in (
        DecisionClassification.LUCKY_GUESS,
        DecisionClassification.CRITICAL_FAILURE,
    )
    assert aar.automated_scores.verification_score <= 25.0
