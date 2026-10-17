# backend/tests/test_aar.py
"""Unit tests for the AAR 4-Quadrant Evaluation Engine and metrics."""

import pytest

from app.engine.scenario_loader import ScenarioLoader
from app.engine.state import SimulationStateManager
from app.schemas.simulation import (
    DecisionClassification,
    InstructorScores,
    Role,
    TacticalAction,
    TraineeDecisionCreate,
    VerificationRequestCreate,
)
from app.services.aar_service import AARService


@pytest.fixture
def session_mgr() -> SimulationStateManager:
    scen = ScenarioLoader.get_default_scenario()
    mgr = SimulationStateManager("SES-TEST-AAR", scen.model_dump())
    return mgr


def test_optimal_decision_quadrant(session_mgr: SimulationStateManager) -> None:
    """Trainee verifies ambiguous contact before taking disciplined action -> OPTIMAL."""
    # Step 1: Trainee conducts verification cross-check
    session_mgr.submit_verification(
        VerificationRequestCreate(
            target_entity_id="TRK-002",
            query="Request electro-optical cross-check on TRK-002 before weapon release.",
            to_role=Role.UNIT_B,
        ),
        from_role=Role.COMMANDER,
    )

    # Step 2: Trainee issues HOLD_VERIFY decision with detailed rationale
    decision = session_mgr.submit_decision(
        TraineeDecisionCreate(
            sim_timestamp=140,
            role=Role.COMMANDER,
            action=TacticalAction.HOLD_VERIFY,
            target_entity_id="TRK-002",
            confidence_score=85,
            rationale="Ambiguous contact TRK-002 displays conflicting civilian AIS and military radar profile. Holding fire to prevent civil fratricide.",
            assumed_risk="Delay allows contact to close within 12nm, but prevents civilian casualty.",
            evidence_message_ids=["MSG-1", "MSG-2"],
        )
    )

    result = AARService.evaluate_session(session_mgr)
    assert result.classification == DecisionClassification.OPTIMAL
    assert result.reasoning_quality == "GOOD"
    assert result.outcome_quality == "GOOD"
    assert result.automated_scores.verification_score >= 75.0
    assert result.final_composite_score >= 70.0


def test_critical_failure_quadrant(session_mgr: SimulationStateManager) -> None:
    """Trainee engages ambiguous civil tanker without verification -> CRITICAL_FAILURE."""
    session_mgr.submit_decision(
        TraineeDecisionCreate(
            sim_timestamp=350,
            role=Role.COMMANDER,
            action=TacticalAction.ENGAGE,
            target_entity_id="TRK-002",
            confidence_score=95,
            rationale="Shoot first.",
            assumed_risk="Low",
            evidence_message_ids=[],
        )
    )

    result = AARService.evaluate_session(session_mgr)
    assert result.classification == DecisionClassification.CRITICAL_FAILURE
    assert result.reasoning_quality == "POOR"
    assert result.outcome_quality == "BAD"
    assert result.automated_scores.verification_attempts == 0


def test_instructor_rubric_blending(session_mgr: SimulationStateManager) -> None:
    """Test blending automated scores with instructor rubric."""
    session_mgr.submit_decision(
        TraineeDecisionCreate(
            sim_timestamp=150,
            role=Role.COMMANDER,
            action=TacticalAction.HOLD_VERIFY,
            target_entity_id="TRK-002",
            confidence_score=75,
            rationale="Holding fire while assessing Sector 4 electronic warfare interference.",
            assumed_risk="Risk of missile lock",
            evidence_message_ids=["MSG-1"],
        )
    )

    inst_scores = InstructorScores(
        situational_awareness=4.5,
        risk_management=4.0,
        adaptability=4.5,
        overall_instructor=4.33,
    )

    result = AARService.evaluate_session(session_mgr, instructor_scores=inst_scores)
    assert result.instructor_scores is not None
    assert result.final_composite_score > 0


def test_csv_export(session_mgr: SimulationStateManager) -> None:
    session_mgr.submit_decision(
        TraineeDecisionCreate(
            sim_timestamp=130,
            role=Role.COMMANDER,
            action=TacticalAction.HOLD_VERIFY,
            target_entity_id="TRK-002",
            confidence_score=80,
            rationale="Validating targets through second channel.",
            assumed_risk="Sector jamming",
            evidence_message_ids=[],
        )
    )
    result = AARService.evaluate_session(session_mgr)
    csv_str = AARService.export_aar_csv(result)
    assert "SIH26248 AFTER ACTION REVIEW (AAR) REPORT" in csv_str
    assert "4-Quadrant Classification" in csv_str
