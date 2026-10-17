# backend/app/models/tables.py
"""SQLAlchemy ORM models for PostgreSQL – all SIH-26248 tables."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ── Helper ────────────────────────────────────────────────────────────────────

def _uuid() -> uuid.UUID:
    return uuid.uuid4()


# ── Scenarios ─────────────────────────────────────────────────────────────────

class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    config_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sessions: Mapped[list["SimulationSession"]] = relationship(back_populates="scenario")


# ── Simulation Sessions ──────────────────────────────────────────────────────

class SimulationSession(Base):
    __tablename__ = "simulation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    scenario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenarios.id"), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("PENDING", "RUNNING", "PAUSED", "COMPLETED", name="session_status_enum"),
        default="PENDING",
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    scenario: Mapped["Scenario"] = relationship(back_populates="sessions")
    users: Mapped[list["SessionUser"]] = relationship(back_populates="session")
    decisions: Mapped[list["TraineeDecision"]] = relationship(back_populates="session")
    verifications: Mapped[list["TraineeVerification"]] = relationship(back_populates="session")


# ── Session Users ─────────────────────────────────────────────────────────────

class SessionUser(Base):
    __tablename__ = "session_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    user_identifier: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("INSTRUCTOR", "COMMANDER", "UNIT_A", "UNIT_B", name="role_enum"),
        nullable=False,
    )

    session: Mapped["SimulationSession"] = relationship(back_populates="users")


# ── Ground Truth Events ───────────────────────────────────────────────────────

class GroundTruthEvent(Base):
    __tablename__ = "ground_truth_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    domain: Mapped[str] = mapped_column(
        Enum("AIR", "SEA", "LAND", "CYBER", name="domain_enum"),
        nullable=False,
    )
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False)

    __table_args__ = (Index("ix_gt_session_time", "session_id", "sim_timestamp"),)


# ── Comms Degradation Rules ──────────────────────────────────────────────────

class CommsDegradationRule(Base):
    __tablename__ = "comms_degradation_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    rule_type: Mapped[str] = mapped_column(
        Enum("NORMAL", "DELAYED", "DROPOUT", "CONFLICTING", name="degradation_type_enum"),
        nullable=False,
    )
    parameters_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    active_window_start: Mapped[int] = mapped_column(Integer, default=0)
    active_window_end: Mapped[int] = mapped_column(Integer, default=9999)


# ── Transmitted Messages ─────────────────────────────────────────────────────

class TransmittedMessage(Base):
    __tablename__ = "transmitted_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    original_event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    source_unit: Mapped[str] = mapped_column(String(128))
    target_unit: Mapped[str] = mapped_column(String(128))
    degradation_type: Mapped[str] = mapped_column(String(32), default="NORMAL")
    delivered_at: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_variant: Mapped[dict] = mapped_column(JSONB, default=dict)


# ── Delivery Status Log ──────────────────────────────────────────────────────

class DeliveryStatusLog(Base):
    __tablename__ = "delivery_status_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transmitted_messages.id"), nullable=False)
    target_role: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="PENDING")  # PENDING | DELIVERED | DROPPED
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)


# ── Trainee Decisions ─────────────────────────────────────────────────────────

class TraineeDecision(Base):
    __tablename__ = "trainee_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    action_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_entity: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    decision_payload: Mapped[dict] = mapped_column(JSONB, default=dict)

    session: Mapped["SimulationSession"] = relationship(back_populates="decisions")
    rationale: Mapped["DecisionRationale | None"] = relationship(back_populates="decision", uselist=False)

    __table_args__ = (Index("ix_decision_session_time", "session_id", "sim_timestamp"),)


# ── Decision Rationales ──────────────────────────────────────────────────────

class DecisionRationale(Base):
    __tablename__ = "decision_rationales"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    decision_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trainee_decisions.id"), unique=True, nullable=False)
    structured_reasons: Mapped[dict] = mapped_column(JSONB, default=dict)
    raw_notes: Mapped[str] = mapped_column(Text, default="")
    evidence_message_ids: Mapped[list] = mapped_column(JSONB, default=list)

    decision: Mapped["TraineeDecision"] = relationship(back_populates="rationale")


# ── Trainee Verifications ─────────────────────────────────────────────────────

class TraineeVerification(Base):
    __tablename__ = "trainee_verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    queried_source: Mapped[str] = mapped_column(String(64))
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    verification_type: Mapped[str] = mapped_column(String(32), default="CROSS_CHECK")

    session: Mapped["SimulationSession"] = relationship(back_populates="verifications")

    __table_args__ = (Index("ix_verify_session_time", "session_id", "sim_timestamp"),)


# ── Instructor Injections ─────────────────────────────────────────────────────

class InstructorInjection(Base):
    __tablename__ = "instructor_injections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    instructor_id: Mapped[str] = mapped_column(String(128))
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    injection_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_units: Mapped[list] = mapped_column(JSONB, default=list)
    payload_override: Mapped[dict] = mapped_column(JSONB, default=dict)


# ── AAR Evaluations ──────────────────────────────────────────────────────────

class AARCEvaluation(Base):
    __tablename__ = "aar_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    decision_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trainee_decisions.id"), nullable=False)
    automated_score: Mapped[float] = mapped_column(Float, default=0)
    latency_score: Mapped[float] = mapped_column(Float, default=0)
    verification_score: Mapped[float] = mapped_column(Float, default=0)
    instructor_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    classification: Mapped[str] = mapped_column(
        Enum("OPTIMAL", "DEFENSIBLE", "CRITICAL_FAILURE", "LUCKY_GUESS", name="classification_enum"),
        nullable=False,
    )


# ── Instructor Rubrics ───────────────────────────────────────────────────────

class InstructorRubric(Base):
    __tablename__ = "instructor_rubrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    situational_awareness_score: Mapped[float] = mapped_column(Float, default=3.0)
    risk_management_score: Mapped[float] = mapped_column(Float, default=3.0)
    adaptability_score: Mapped[float] = mapped_column(Float, default=3.0)
    notes: Mapped[str] = mapped_column(Text, default="")


# ── Forensic Snapshots ────────────────────────────────────────────────────────

class ForensicSnapshot(Base):
    __tablename__ = "forensic_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_sessions.id"), nullable=False)
    sim_timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_type: Mapped[str] = mapped_column(String(32), default="PERIODIC")  # PERIODIC | DECISION_MOMENT
    ground_truth_state: Mapped[dict] = mapped_column(JSONB, nullable=False)
    comms_state: Mapped[dict] = mapped_column(JSONB, default=dict)
    unit_a_view: Mapped[dict] = mapped_column(JSONB, default=dict)
    unit_b_view: Mapped[dict] = mapped_column(JSONB, default=dict)
    commander_view: Mapped[dict] = mapped_column(JSONB, default=dict)
    visible_feeds: Mapped[list] = mapped_column(JSONB, default=list)

    __table_args__ = (Index("ix_snapshot_session_time", "session_id", "sim_timestamp"),)
