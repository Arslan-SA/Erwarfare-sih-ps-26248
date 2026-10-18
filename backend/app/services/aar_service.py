# backend/app/services/aar_service.py
"""After Action Review (AAR) & 4-Quadrant Evaluation Service.

Evaluates trainee performance according to SIH-26248 blueprint:
- 4-Quadrant Decision Matrix (Optimal, Defensible, Lucky Guess, Critical Failure)
- Automated metric evaluation (latency, verification rigor, info sharing)
- Dual-timeline forensic reconstruction (Ground Truth vs Trainee Perception)
"""

from __future__ import annotations

import csv
import io
from typing import Any, Optional

from app.core.logging import get_logger
from app.engine.state import SimulationStateManager
from app.schemas.simulation import (
    AARResultSchema,
    AutomatedScores,
    DecisionClassification,
    InstructorScores,
    TacticalAction,
    TargetClassification,
)

logger = get_logger(__name__)


class AARService:
    """Computes comprehensive after-action review scoring and timeline reconstructions."""

    @staticmethod
    def evaluate_session(
        state_mgr: SimulationStateManager,
        instructor_scores: Optional[InstructorScores] = None,
        evaluator_notes: str = "",
    ) -> AARResultSchema:
        """Run full evaluation on a completed simulation session."""
        decisions = state_mgr.trainee_decisions
        verifications = state_mgr.verification_requests

        if not decisions:
            # Default placeholder when no decision was submitted
            automated = AutomatedScores(
                response_latency_sec=0.0,
                latency_score=0.0,
                verification_attempts=0,
                verification_score=0.0,
                information_sharing_score=0.0,
                overall_automated=0.0,
            )
            return AARResultSchema(
                session_id=state_mgr.session_id,
                decision_moment_t=0,
                classification=DecisionClassification.CRITICAL_FAILURE,
                automated_scores=automated,
                instructor_scores=instructor_scores,
                final_composite_score=0.0,
                reasoning_quality="POOR",
                outcome_quality="BAD",
                evaluator_notes="Session ended without any decision submitted.",
            )

        # Focus evaluation on the primary critical decision
        primary_decision = decisions[0]
        decision_time = primary_decision.sim_timestamp
        target_entity_id = primary_decision.target_entity_id

        # 1. LATENCY METRIC
        # Critical alert triggered around T=120s in scenario
        trigger_time = 120
        latency_sec = max(0, decision_time - trigger_time)
        # Benchmark: under 60s latency gets full score, decays after 180s
        if latency_sec <= 60:
            latency_score = 100.0
        elif latency_sec <= 180:
            latency_score = max(0.0, 100.0 - ((latency_sec - 60) / 120.0) * 60.0)
        else:
            latency_score = max(10.0, 40.0 - ((latency_sec - 180) / 100.0) * 30.0)

        # 2. VERIFICATION RIGOR
        # Check if trainee verified target before engaging
        relevant_verifications = [
            v for v in verifications
            if v.target_entity_id == target_entity_id and v.sim_timestamp <= decision_time
        ]
        verification_count = len(relevant_verifications)

        if verification_count >= 2:
            verification_score = 100.0
        elif verification_count == 1:
            verification_score = 75.0
        else:
            verification_score = 25.0

        # 3. INFORMATION SHARING & EVIDENCE REFERENCING
        evidence_count = len(primary_decision.evidence_message_ids)
        rationale_len = len(primary_decision.rationale)
        sharing_score = min(100.0, (evidence_count * 25.0) + (min(rationale_len, 200) / 200.0 * 50.0))

        # Composite automated score
        overall_automated = (
            (latency_score * 0.35) +
            (verification_score * 0.40) +
            (sharing_score * 0.25)
        )

        automated = AutomatedScores(
            response_latency_sec=float(latency_sec),
            latency_score=round(latency_score, 1),
            verification_attempts=verification_count,
            verification_score=round(verification_score, 1),
            information_sharing_score=round(sharing_score, 1),
            overall_automated=round(overall_automated, 1),
        )

        # 4. QUADRANT CLASSIFICATION LOGIC
        # Find ground truth nature of target
        target_gt = next((e for e in state_mgr.ground_truth_entities if e.id == target_entity_id), None)
        is_actually_hostile = target_gt and target_gt.classification == TargetClassification.HOSTILE

        # Reasoning Quality: Did trainee cross-check ambiguous target and provide solid rationale?
        reasoning_is_good = verification_count >= 1 and len(primary_decision.rationale) >= 20

        # Outcome Quality: Did decision match true threat reality?
        outcome_is_good = False
        if primary_decision.action == TacticalAction.ENGAGE:
            # Engaging is only good if target was genuinely hostile!
            outcome_is_good = is_actually_hostile
        elif primary_decision.action in (TacticalAction.HOLD_VERIFY, TacticalAction.VECTOR_SUPPORT):
            # Holding/verifying ambiguous target avoids fratricide
            outcome_is_good = True
        else:
            outcome_is_good = False

        if reasoning_is_good and outcome_is_good:
            classification = DecisionClassification.OPTIMAL
        elif reasoning_is_good and not outcome_is_good:
            classification = DecisionClassification.DEFENSIBLE
        elif not reasoning_is_good and outcome_is_good:
            classification = DecisionClassification.LUCKY_GUESS
        else:
            classification = DecisionClassification.CRITICAL_FAILURE

        # 5. COMPOSITE BLEND WITH INSTRUCTOR SCORES
        if instructor_scores:
            instructor_composite = (
                (instructor_scores.situational_awareness / 5.0 * 100.0) * 0.35 +
                (instructor_scores.risk_management / 5.0 * 100.0) * 0.35 +
                (instructor_scores.adaptability / 5.0 * 100.0) * 0.30
            )
            final_composite = (overall_automated * 0.50) + (instructor_composite * 0.50)
        else:
            final_composite = overall_automated

        return AARResultSchema(
            session_id=state_mgr.session_id,
            decision_moment_t=decision_time,
            classification=classification,
            automated_scores=automated,
            instructor_scores=instructor_scores,
            final_composite_score=round(final_composite, 1),
            reasoning_quality="GOOD" if reasoning_is_good else "POOR",
            outcome_quality="GOOD" if outcome_is_good else "BAD",
            evaluator_notes=evaluator_notes or f"Evaluated with {classification.value} classification.",
        )

    @staticmethod
    def generate_dual_timeline(state_mgr: SimulationStateManager) -> list[dict[str, Any]]:
        """Construct side-by-side timeline comparing Ground Truth vs Trainee Perceived Truth."""
        timeline: list[dict[str, Any]] = []
        snapshots = state_mgr.forensic_snapshots

        for s in snapshots:
            t = s.get("sim_timestamp", 0)
            gt_entities = s.get("ground_truth_entities", [])
            views = s.get("views", {})
            cmdr_view = views.get("COMMANDER", [])

            # Target 2 (TRK-002) is the focal ambiguous track
            gt_trk2 = next((e for e in gt_entities if e.get("id") == "TRK-002"), None)
            cmdr_trk2 = next((e for e in cmdr_view if e.get("id") == "TRK-002"), None)

            gt_class = gt_trk2.get("classification") if gt_trk2 else "UNKNOWN"
            perceived_class = cmdr_trk2.get("classification") if cmdr_trk2 else "UNKNOWN"

            has_divergence = gt_class != perceived_class

            timeline.append({
                "sim_time": t,
                "snapshot_type": s.get("snapshot_type"),
                "ground_truth_classification": gt_class,
                "perceived_classification": perceived_class,
                "divergence_present": has_divergence,
                "ew_intensity": s.get("ew_conditions", {}).get("global_intensity", 0),
                "is_decision_moment": s.get("snapshot_type") == "DECISION_MOMENT",
            })

        return timeline

    @staticmethod
    def export_aar_csv(evaluation: AARResultSchema) -> str:
        """Export AAR evaluation metrics as formatted CSV string."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["SIH26248 AFTER ACTION REVIEW (AAR) REPORT"])
        writer.writerow(["Session ID", evaluation.session_id])
        writer.writerow(["Decision Moment (Sim Sec)", evaluation.decision_moment_t])
        writer.writerow(["4-Quadrant Classification", evaluation.classification.value])
        writer.writerow(["Reasoning Quality", evaluation.reasoning_quality])
        writer.writerow(["Outcome Quality", evaluation.outcome_quality])
        writer.writerow(["Final Composite Score", evaluation.final_composite_score])
        writer.writerow([])
        writer.writerow(["AUTOMATED SCORES", "VALUE"])
        writer.writerow(["Response Latency (sec)", evaluation.automated_scores.response_latency_sec])
        writer.writerow(["Latency Score", evaluation.automated_scores.latency_score])
        writer.writerow(["Verification Attempts", evaluation.automated_scores.verification_attempts])
        writer.writerow(["Verification Score", evaluation.automated_scores.verification_score])
        writer.writerow(["Information Sharing Score", evaluation.automated_scores.information_sharing_score])
        writer.writerow(["Overall Automated", evaluation.automated_scores.overall_automated])

        if evaluation.instructor_scores:
            writer.writerow([])
            writer.writerow(["INSTRUCTOR RUBRIC", "VALUE"])
            writer.writerow(["Situational Awareness (1-5)", evaluation.instructor_scores.situational_awareness])
            writer.writerow(["Risk Management (1-5)", evaluation.instructor_scores.risk_management])
            writer.writerow(["Adaptability (1-5)", evaluation.instructor_scores.adaptability])
            writer.writerow(["Overall Instructor", evaluation.instructor_scores.overall_instructor])

        writer.writerow([])
        writer.writerow(["Evaluator Notes", evaluation.evaluator_notes])

        return output.getvalue()

    @staticmethod
    def export_raw_events_csv(state_mgr: SimulationStateManager) -> str:
        """Export raw telemetry, feeds, verifications, and decisions for scientific data analysis."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "RECORD_TYPE",
            "SIM_TIMESTAMP",
            "ID",
            "SOURCE_OR_ROLE",
            "TARGET_OR_RECIPIENT",
            "DOMAIN",
            "TITLE_OR_ACTION",
            "DEGRADATION_OR_STATUS",
            "DIVERGENCE_VARIANT",
            "CERTAINTY_OR_CONFIDENCE",
            "DETAIL_PAYLOAD",
        ])

        # 1. Feed messages
        for f in state_mgr.all_feed_messages:
            writer.writerow([
                "INTEL_FEED",
                f.sim_timestamp,
                f.id,
                f.source_unit,
                f.target_role.value,
                f.domain.value,
                f.title,
                f.degradation_type.value,
                f.divergence_variant or "NONE",
                "VERIFIED" if f.is_verified else "UNVERIFIED",
                f.content,
            ])

        # 2. Verifications
        for v in state_mgr.verification_requests:
            writer.writerow([
                "VERIFICATION_CROSS_CHECK",
                v.sim_timestamp,
                v.id,
                v.from_role.value,
                v.to_role.value,
                "TACTICAL",
                v.target_entity_id,
                v.status,
                "NONE",
                "N/A",
                f"Query: {v.query} | Response: {v.response}",
            ])

        # 3. Decisions
        for d in state_mgr.trainee_decisions:
            writer.writerow([
                "TRAINEE_DECISION",
                d.sim_timestamp,
                d.id,
                d.role.value,
                d.target_entity_id,
                "COMMAND",
                d.action.value,
                "SUBMITTED",
                "EVIDENCE:" + ",".join(d.evidence_message_ids),
                f"{d.confidence_score}%",
                f"Rationale: {d.rationale} | Risk: {d.assumed_risk}",
            ])

        # 4. Forensic snapshots
        for s in state_mgr.forensic_snapshots:
            writer.writerow([
                "FORENSIC_SNAPSHOT",
                s.get("sim_timestamp", 0),
                s.get("snapshot_id", ""),
                "SYSTEM_CLOCK",
                "ALL_ROLES",
                "GLOBAL",
                s.get("snapshot_type", "PERIODIC"),
                f"EW_INTENSITY:{s.get('ew_conditions', {}).get('global_intensity', 0)}%",
                "NONE",
                "100%",
                f"Entities: {len(s.get('ground_truth_entities', []))} | Feeds: {s.get('feed_count', 0)}",
            ])

        return output.getvalue()

    @staticmethod
    def generate_html_report(
        state_mgr: SimulationStateManager,
        instructor_scores: Optional[InstructorScores] = None,
        evaluator_notes: str = "",
    ) -> str:
        """Generate standalone printable HTML/PDF report."""
        from app.services.report_generator import AARReportGenerator
        evaluation = AARService.evaluate_session(
            state_mgr, instructor_scores=instructor_scores, evaluator_notes=evaluator_notes
        )
        return AARReportGenerator.generate_html_report(evaluation, state_mgr)

