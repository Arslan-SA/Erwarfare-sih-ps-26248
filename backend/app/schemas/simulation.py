# backend/app/schemas/simulation.py
"""Pydantic V2 schemas matching the SIH-26248 blueprint data contracts."""

from __future__ import annotations

import enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enumerations ──────────────────────────────────────────────────────────────

class Role(str, enum.Enum):
    INSTRUCTOR = "INSTRUCTOR"
    COMMANDER = "COMMANDER"
    UNIT_A = "UNIT_A"
    UNIT_B = "UNIT_B"


class DegradationType(str, enum.Enum):
    NORMAL = "NORMAL"
    DELAYED = "DELAYED"
    DROPOUT = "DROPOUT"
    CONFLICTING = "CONFLICTING"


class EntityDomain(str, enum.Enum):
    AIR = "AIR"
    SEA = "SEA"
    LAND = "LAND"
    CYBER = "CYBER"


class TargetClassification(str, enum.Enum):
    HOSTILE = "HOSTILE"
    FRIENDLY = "FRIENDLY"
    UNKNOWN = "UNKNOWN"
    AMBIGUOUS = "AMBIGUOUS"


class SessionStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"


class DecisionClassification(str, enum.Enum):
    OPTIMAL = "OPTIMAL"
    DEFENSIBLE = "DEFENSIBLE"
    LUCKY_GUESS = "LUCKY_GUESS"
    CRITICAL_FAILURE = "CRITICAL_FAILURE"


class TacticalAction(str, enum.Enum):
    ENGAGE = "ENGAGE"
    HOLD_VERIFY = "HOLD_VERIFY"
    VECTOR_SUPPORT = "VECTOR_SUPPORT"
    EVACUATE = "EVACUATE"


# ── Tactical Entity ──────────────────────────────────────────────────────────

class TacticalEntitySchema(BaseModel):
    id: str
    name: str
    domain: EntityDomain
    classification: TargetClassification
    x: float = Field(ge=0, le=100, description="Normalised X coordinate (0-100)")
    y: float = Field(ge=0, le=100, description="Normalised Y coordinate (0-100)")
    speed_knots: float = 0
    heading_deg: float = 0
    status: str = "ACTIVE"
    observed_by_roles: list[Role] = []
    divergence_note: Optional[str] = None


# ── Feed Message ─────────────────────────────────────────────────────────────

class FeedMessageSchema(BaseModel):
    id: str
    sim_timestamp: int
    source_unit: str
    target_role: Role
    domain: EntityDomain
    title: str
    content: str
    degradation_type: DegradationType = DegradationType.NORMAL
    divergence_variant: Optional[str] = None
    is_verified: bool = False


# ── Trainee Decision ─────────────────────────────────────────────────────────

class TraineeDecisionCreate(BaseModel):
    sim_timestamp: int
    role: Role
    action: TacticalAction
    target_entity_id: str
    confidence_score: int = Field(ge=0, le=100)
    rationale: str = Field(min_length=10)
    assumed_risk: str
    evidence_message_ids: list[str] = []


class TraineeDecisionSchema(TraineeDecisionCreate):
    id: str
    submitted_at_wall_time: str


# ── Verification Request ─────────────────────────────────────────────────────

class VerificationRequestCreate(BaseModel):
    target_entity_id: str
    query: str
    to_role: Role


class VerificationRequestSchema(BaseModel):
    id: str
    sim_timestamp: int
    from_role: Role
    to_role: Role
    target_entity_id: str
    query: str
    response: Optional[str] = None
    status: str = "PENDING"  # PENDING | ANSWERED | JAMMED


# ── EW Rule ──────────────────────────────────────────────────────────────────

class EWRuleSchema(BaseModel):
    id: str
    name: str
    type: DegradationType
    intensity_percent: int = Field(ge=0, le=100)
    affected_role: str = "ALL"  # Role or "ALL"
    active: bool = True


# ── Instructor Injection ─────────────────────────────────────────────────────

class InstructorInjection(BaseModel):
    injection_type: str  # "SEVER_COMMS" | "INJECT_CONFLICT" | "SET_EW_INTENSITY" | "SPOOF"
    target_unit: Optional[str] = None
    payload: dict = {}


# ── AAR Evaluation ───────────────────────────────────────────────────────────

class AutomatedScores(BaseModel):
    response_latency_sec: float
    latency_score: float
    verification_attempts: int
    verification_score: float
    information_sharing_score: float
    overall_automated: float


class InstructorScores(BaseModel):
    situational_awareness: float = Field(ge=1, le=5)
    risk_management: float = Field(ge=1, le=5)
    adaptability: float = Field(ge=1, le=5)
    overall_instructor: float


class AARResultSchema(BaseModel):
    session_id: str
    decision_moment_t: int
    classification: DecisionClassification
    automated_scores: AutomatedScores
    instructor_scores: Optional[InstructorScores] = None
    final_composite_score: float
    reasoning_quality: str  # GOOD | POOR
    outcome_quality: str  # GOOD | BAD
    evaluator_notes: str = ""


# ── Scenario Config ──────────────────────────────────────────────────────────

class ScenarioTimelineEvent(BaseModel):
    sim_time_offset: int = Field(ge=0, description="Seconds from scenario start")
    event_type: str
    domain: EntityDomain
    authoritative_data: dict
    default_recipients: list[Role]
    degradation_override: Optional[DegradationType] = None


class DegradationSchedule(BaseModel):
    start_time: int = Field(ge=0)
    end_time: int = Field(ge=0)
    affected_channels: list[Role]
    condition: DegradationType


class ScenarioConfig(BaseModel):
    """V1 Scenario Configuration – matches blueprint Page 4."""
    scenario_id: str
    name: str
    tactical_context: str
    difficulty: str = "MEDIUM"
    simulated_duration_seconds: int
    roles: list[Role]
    initial_entities: list[TacticalEntitySchema]
    timeline_events: list[ScenarioTimelineEvent]
    degradation_schedule: list[DegradationSchedule] = []


# ── Clock Control ────────────────────────────────────────────────────────────

class ClockControlRequest(BaseModel):
    action: str  # "start" | "pause" | "resume" | "step" | "stop"
    time_multiplier: Optional[float] = None


class ClockStatusResponse(BaseModel):
    sim_time: int
    clock_running: bool
    time_multiplier: float
    session_status: SessionStatus
