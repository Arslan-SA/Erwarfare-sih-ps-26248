# backend/app/models/tables.py
"""SQLAlchemy ORM models for Supabase / PostgreSQL and SQLite.

Supports full persistence for:
- User accounts and authentication credentials
- Scenarios and active simulation sessions
- Session users and role bindings
- Ground truth events & comms degradation rules
- Trainee decisions, structured rationales, and evidence linkages
- Trainee cross-verification requests and responses
- Instructor dynamic injections and subjective rubric evaluations
- Forensic dual-timeline snapshots
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


# ── User Accounts & Auth ──────────────────────────────────────────────────────

class UserAccount(Base):
    """Registered operator account with credentials and military duty station."""
    __tablename__ = "user_accounts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    service_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    call_sign: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # COMMANDER, UNIT_A, UNIT_B, INSTRUCTOR
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    clearance_level: Mapped[str] = mapped_column(String(128), nullable=False)
    station_title: Mapped[str] = mapped_column(String(128), default="")
    station_description: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Scenarios ─────────────────────────────────────────────────────────────────

class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sessions: Mapped[list["SimulationSession"]] = relationship(back_populates="scenario")


# ── Simulation Sessions ──────────────────────────────────────────────────────

class SimulationSession(Base):
    __tablename__ = "simulation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, default="SES-MALACCA-001")
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("scenarios.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="RUNNING")  # PENDING, RUNNING, PAUSED, COMPLETED
    current_sim_time: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    scenario: Mapped["Scenario | None"] = relationship(back_populates="sessions")
    users: Mapped[list["SessionUser"]] = relationship(back_populates="session")
    decisions: Mapped[list["TraineeDecision"]] = relationship(back_populates="session")
    verifications: Mapped[list["TraineeVerification"]] = relationship(back_populates="session")


# ── Session Users ─────────────────────────────────────────────────────────────

class SessionUser(Base):
    __tablename__ = "session_users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    user_identifier: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)

    session: Mapped["SimulationSession"] = relationship(back_populates="users")


# ── Ground Truth Events ───────────────────────────────────────────────────────

class GroundTruthEvent(Base):
    __tablename__ = "ground_truth_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    domain: Mapped[str] = mapped_column(String(32), nullable=False)  # AIR, SEA, LAND, CYBER
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    __table_args__ = (Index("ix_gt_session_time", "session_id", "sim_timestamp"),)


# ── Comms Degradation Rules ──────────────────────────────────────────────────

class CommsDegradationRule(Base):
    __tablename__ = "comms_degradation_rules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(32), nullable=False)  # NORMAL, DELAYED, DROPOUT, CONFLICTING
    parameters_json: Mapped[dict] = mapped_column(JSON, default=dict)
    active_window_start: Mapped[int] = mapped_column(Integer, default=0)
    active_window_end: Mapped[int] = mapped_column(Integer, default=9999)


# ── Transmitted Messages ─────────────────────────────────────────────────────

class TransmittedMessage(Base):
    __tablename__ = "transmitted_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    original_event_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    source_unit: Mapped[str] = mapped_column(String(128))
    target_unit: Mapped[str] = mapped_column(String(128))
    degradation_type: Mapped[str] = mapped_column(String(32), default="NORMAL")
    delivered_at: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_variant: Mapped[dict] = mapped_column(JSON, default=dict)


# ── Delivery Status Log ──────────────────────────────────────────────────────

class DeliveryStatusLog(Base):
    __tablename__ = "delivery_status_log"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transmitted_messages.id"), nullable=False)
    target_role: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="PENDING")  # PENDING | DELIVERED | DROPPED
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)


# ── Trainee Decisions ─────────────────────────────────────────────────────────

class TraineeDecision(Base):
    __tablename__ = "trainee_decisions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    action_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_entity: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    decision_payload: Mapped[dict] = mapped_column(JSON, default=dict)

    session: Mapped["SimulationSession"] = relationship(back_populates="decisions")
    rationale: Mapped["DecisionRationale | None"] = relationship(back_populates="decision", uselist=False)

    __table_args__ = (Index("ix_decision_session_time", "session_id", "sim_timestamp"),)


# ── Decision Rationales ──────────────────────────────────────────────────────

class DecisionRationale(Base):
    __tablename__ = "decision_rationales"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    decision_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trainee_decisions.id"), unique=True, nullable=False)
    structured_reasons: Mapped[dict] = mapped_column(JSON, default=dict)
    raw_notes: Mapped[str] = mapped_column(Text, default="")
    evidence_message_ids: Mapped[list] = mapped_column(JSON, default=list)

    decision: Mapped["TraineeDecision"] = relationship(back_populates="rationale")


# ── Trainee Verifications ─────────────────────────────────────────────────────

class TraineeVerification(Base):
    __tablename__ = "trainee_verifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    from_role: Mapped[str] = mapped_column(String(32), default="COMMANDER")
    to_role: Mapped[str] = mapped_column(String(32), default="UNIT_A")
    target_entity: Mapped[str] = mapped_column(String(64), default="TRK-002")
    query_text: Mapped[str] = mapped_column(Text, default="")
    response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="PENDING")  # PENDING | ANSWERED | JAMMED
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped["SimulationSession"] = relationship(back_populates="verifications")

    __table_args__ = (Index("ix_verify_session_time", "session_id", "sim_timestamp"),)


# ── Instructor Injections ─────────────────────────────────────────────────────

class InstructorInjection(Base):
    __tablename__ = "instructor_injections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    instructor_id: Mapped[str] = mapped_column(String(128))
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    injection_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_units: Mapped[list] = mapped_column(JSON, default=list)
    payload_override: Mapped[dict] = mapped_column(JSON, default=dict)


# ── AAR Evaluations ──────────────────────────────────────────────────────────

class AARCEvaluation(Base):
    __tablename__ = "aar_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    decision_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trainee_decisions.id"), nullable=True)
    automated_score: Mapped[float] = mapped_column(Float, default=0)
    latency_score: Mapped[float] = mapped_column(Float, default=0)
    verification_score: Mapped[float] = mapped_column(Float, default=0)
    instructor_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_composite_score: Mapped[float] = mapped_column(Float, default=0)
    classification: Mapped[str] = mapped_column(String(32), default="DEFENSIBLE")
    reasoning_quality: Mapped[str] = mapped_column(String(16), default="GOOD")
    outcome_quality: Mapped[str] = mapped_column(String(16), default="GOOD")
    evaluator_notes: Mapped[str] = mapped_column(Text, default="")


# ── Instructor Rubrics ───────────────────────────────────────────────────────

class InstructorRubric(Base):
    __tablename__ = "instructor_rubrics"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    situational_awareness_score: Mapped[float] = mapped_column(Float, default=3.0)
    risk_management_score: Mapped[float] = mapped_column(Float, default=3.0)
    adaptability_score: Mapped[float] = mapped_column(Float, default=3.0)
    overall_score: Mapped[float] = mapped_column(Float, default=70.0)
    notes: Mapped[str] = mapped_column(Text, default="")


# ── Forensic Snapshots ────────────────────────────────────────────────────────

class ForensicSnapshot(Base):
    __tablename__ = "forensic_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_type: Mapped[str] = mapped_column(String(32), default="PERIODIC")  # PERIODIC | DECISION_MOMENT
    ground_truth_state: Mapped[dict] = mapped_column(JSON, nullable=False)
    comms_state: Mapped[dict] = mapped_column(JSON, default=dict)
    unit_a_view: Mapped[dict] = mapped_column(JSON, default=dict)
    unit_b_view: Mapped[dict] = mapped_column(JSON, default=dict)
    commander_view: Mapped[dict] = mapped_column(JSON, default=dict)
    visible_feeds: Mapped[list] = mapped_column(JSON, default=list)

    __table_args__ = (Index("ix_snapshot_session_time", "session_id", "sim_timestamp"),)
