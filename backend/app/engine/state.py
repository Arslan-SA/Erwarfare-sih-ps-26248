# backend/app/engine/state.py
"""Central Simulation Session State Manager.

Coordinates the clock, EW degradation engine, projection engine,
ground truth entities, decision intake, and forensic state snapshotting.
"""

from __future__ import annotations

import datetime
import math
import uuid
from typing import Any, Optional

from app.core.logging import get_logger
from app.engine.clock import ScheduledEvent, SimulationClock
from app.engine.ew.degradation import EWEngine
from app.engine.projection import ProjectionEngine
from app.schemas.simulation import (
    DegradationType,
    EntityDomain,
    FeedMessageSchema,
    Role,
    SessionStatus,
    TacticalAction,
    TacticalEntitySchema,
    TargetClassification,
    TraineeDecisionCreate,
    TraineeDecisionSchema,
    VerificationRequestCreate,
    VerificationRequestSchema,
)

logger = get_logger(__name__)


class SimulationStateManager:
    """In-memory authoritative state manager for an active simulation session."""

    def __init__(self, session_id: str, scenario_config: dict[str, Any]) -> None:
        self.session_id = session_id
        self.scenario_config = scenario_config
        self.status = SessionStatus.PENDING

        # Sub-engines
        self.clock = SimulationClock(
            duration_seconds=scenario_config.get("simulated_duration_seconds", 420),
            time_multiplier=1.0,
        )
        self.ew_engine = EWEngine()
        self.projection_engine = ProjectionEngine(self.ew_engine)

        # Authoritative state
        self.ground_truth_entities: list[TacticalEntitySchema] = []
        self.all_feed_messages: list[FeedMessageSchema] = []
        self.trainee_decisions: list[TraineeDecisionSchema] = []
        self.verification_requests: list[VerificationRequestSchema] = []
        self.forensic_snapshots: list[dict[str, Any]] = []

        # Setup listeners
        self.clock.register_tick_callback(self._on_clock_tick)
        self.clock.register_event_handler(self._on_scheduled_event)

        self._init_scenario_data()

    def _init_scenario_data(self) -> None:
        """Seed initial tactical entities and schedule scenario events."""
        initial_entities = self.scenario_config.get("initial_entities", [])
        for ent in initial_entities:
            self.ground_truth_entities.append(TacticalEntitySchema(**ent))

        # Schedule timeline events from scenario config into the clock priority queue
        events = self.scenario_config.get("timeline_events", [])
        for evt in events:
            sim_time = evt.get("sim_time_offset", 0)
            self.clock.schedule_event(
                sim_time=sim_time,
                event_type=evt.get("event_type", "INTEL_FEED"),
                payload=evt,
                event_id=f"EVT_{sim_time}_{evt.get('event_type')}",
            )

        logger.info(
            "Scenario state initialized",
            session_id=self.session_id,
            entities_count=len(self.ground_truth_entities),
            events_scheduled=len(events),
        )

    async def _on_clock_tick(self, current_sim_time: int) -> None:
        """Executed every second of simulation time."""
        # 1. Kinematic dead-reckoning movement for dynamic entities
        for entity in self.ground_truth_entities:
            if entity.speed_knots > 0:
                # Approximate kinematic displacement per second
                rad = math.radians(entity.heading_deg)
                dx = math.sin(rad) * (entity.speed_knots / 3600.0) * 0.1
                dy = -math.cos(rad) * (entity.speed_knots / 3600.0) * 0.1
                entity.x = min(100.0, max(0.0, entity.x + dx))
                entity.y = min(100.0, max(0.0, entity.y + dy))

        # 2. Drain delayed messages released by the EW queue
        released_messages = self.ew_engine.drain_delayed_messages(current_sim_time)
        for msg in released_messages:
            self.all_feed_messages.append(msg)
            logger.info("Delayed feed message published", msg_id=msg.id, sim_time=current_sim_time)

        # 3. Take periodic forensic snapshot every 30 seconds
        if current_sim_time % 30 == 0:
            self._capture_forensic_snapshot(current_sim_time, snapshot_type="PERIODIC")

    async def _on_scheduled_event(self, event: ScheduledEvent) -> None:
        """Handles scenario events popped from the clock priority queue."""
        payload = event.payload
        event_type = event.event_type

        if event_type == "INTEL_FEED":
            auth = payload.get("authoritative_data", {})
            recipients = payload.get("default_recipients", ["COMMANDER"])
            degradation = payload.get("degradation_override", DegradationType.NORMAL)

            for rec in recipients:
                raw_msg = FeedMessageSchema(
                    id=f"MSG-{event.sim_time}-{uuid.uuid4().hex[:6].upper()}",
                    sim_timestamp=event.sim_time,
                    source_unit=auth.get("source_unit", "HQ_INTEL"),
                    target_role=Role(rec),
                    domain=EntityDomain(payload.get("domain", "SEA")),
                    title=auth.get("title", "Tactical Update"),
                    content=auth.get("content", ""),
                    degradation_type=DegradationType(degradation),
                    divergence_variant=auth.get("divergence_variant"),
                    is_verified=False,
                )

                # Route through EW degradation engine
                processed = self.ew_engine.process_outbound_message(raw_msg, event.sim_time)
                if processed is not None:
                    self.all_feed_messages.append(processed)

        elif event_type == "EW_SURGE":
            intensity = payload.get("intensity", 85)
            self.ew_engine.set_global_intensity(intensity)

        elif event_type == "SEVER_LINK":
            r1 = payload.get("role_a", "COMMANDER")
            r2 = payload.get("role_b", "UNIT_B")
            self.ew_engine.sever_link(r1, r2)

    def _capture_forensic_snapshot(self, sim_time: int, snapshot_type: str = "PERIODIC") -> dict[str, Any]:
        """Capture omniscient ground truth vs asymmetric views for AAR reconstruction."""
        snapshot = {
            "snapshot_id": str(uuid.uuid4()),
            "sim_timestamp": sim_time,
            "snapshot_type": snapshot_type,
            "captured_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "ground_truth_entities": [e.model_dump() for e in self.ground_truth_entities],
            "views": {
                "COMMANDER": [e.model_dump() for e in self.projection_engine.project_entities_for_role(self.ground_truth_entities, Role.COMMANDER)],
                "UNIT_A": [e.model_dump() for e in self.projection_engine.project_entities_for_role(self.ground_truth_entities, Role.UNIT_A)],
                "UNIT_B": [e.model_dump() for e in self.projection_engine.project_entities_for_role(self.ground_truth_entities, Role.UNIT_B)],
            },
            "ew_conditions": {
                "global_intensity": self.ew_engine.global_ew_intensity,
                "severed_links": list(self.ew_engine.severed_links),
                "delayed_queue_depth": len(self.ew_engine.delayed_queue),
            },
            "feed_count": len(self.all_feed_messages),
        }
        self.forensic_snapshots.append(snapshot)
        return snapshot

    def submit_decision(self, decision_in: TraineeDecisionCreate) -> TraineeDecisionSchema:
        """Record a trainee tactical decision at T_decision and freeze forensic snapshot."""
        decision = TraineeDecisionSchema(
            id=f"DEC-{uuid.uuid4().hex[:8].upper()}",
            submitted_at_wall_time=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            **decision_in.model_dump(),
        )
        self.trainee_decisions.append(decision)

        # Freeze crucial T_decision snapshot for AAR
        self._capture_forensic_snapshot(decision.sim_timestamp, snapshot_type="DECISION_MOMENT")

        logger.info(
            "Trainee decision submitted",
            decision_id=decision.id,
            action=decision.action.value,
            sim_time=decision.sim_timestamp,
            confidence=decision.confidence_score,
        )
        return decision

    def submit_verification(self, verify_in: VerificationRequestCreate, from_role: Role) -> VerificationRequestSchema:
        """Record trainee cross-examination inquiry between tactical units."""
        # Determine if response is delayed or blocked by EW
        is_severed = self.ew_engine.is_link_severed(from_role.value, verify_in.to_role.value)
        status = "JAMMED" if is_severed else "ANSWERED"
        response_text = None

        if status == "ANSWERED":
            if verify_in.target_entity_id == "TRK-002":
                response_text = f"[{verify_in.to_role.value}] Confirms TRK-002 ESM signature matches civil fishing vessel AIS-8829; no missile telemetry observed."
            else:
                response_text = f"[{verify_in.to_role.value}] Contact verified against local sensor radar sweep."
        else:
            response_text = f"[{verify_in.to_role.value}] Transmission failed: RF link jammed or severed by electronic attack."

        v = VerificationRequestSchema(
            id=f"VERIF-{uuid.uuid4().hex[:6].upper()}",
            sim_timestamp=self.clock.current_sim_time,
            from_role=from_role,
            to_role=verify_in.to_role,
            target_entity_id=verify_in.target_entity_id,
            query=verify_in.query,
            response=response_text,
            status=status,
        )
        self.verification_requests.append(v)
        return v

    def get_role_projection(self, role: Role) -> dict[str, Any]:
        """Generate client-tailored state payload for UI consumption."""
        entities = self.projection_engine.project_entities_for_role(self.ground_truth_entities, role)
        feeds = self.projection_engine.project_feed_for_role(self.all_feed_messages, role)
        uncertainty = self.projection_engine.calculate_uncertainty_snapshot(self.ground_truth_entities, role)

        return {
            "session_id": self.session_id,
            "sim_time": self.clock.current_sim_time,
            "clock_running": self.clock.is_running,
            "time_multiplier": self.clock.time_multiplier,
            "role": role.value,
            "entities": [e.model_dump() for e in entities],
            "feeds": [f.model_dump() for f in feeds],
            "decisions": [d.model_dump() for d in self.trainee_decisions],
            "verifications": [v.model_dump() for v in self.verification_requests],
            "uncertainty_metrics": uncertainty,
        }
