# backend/app/services/session_service.py
"""Session Service orchestrating simulation instances, clock ticks, and client pushes."""

from __future__ import annotations

import uuid
from typing import Any, Optional

from app.core.logging import get_logger
from app.engine.scenario_loader import ScenarioLoader
from app.engine.state import SimulationStateManager
from app.schemas.simulation import (
    ClockControlRequest,
    ClockStatusResponse,
    Role,
    SessionStatus,
    TraineeDecisionCreate,
    TraineeDecisionSchema,
    VerificationRequestCreate,
    VerificationRequestSchema,
)
from app.services.websocket_manager import ws_manager

logger = get_logger(__name__)


class SessionService:
    """Manages active simulation session instances."""

    def __init__(self) -> None:
        # session_id -> SimulationStateManager
        self.active_sessions: dict[str, SimulationStateManager] = {}

    def create_session(self, scenario_config: Optional[dict[str, Any]] = None) -> SimulationStateManager:
        """Initialize a new simulation session."""
        session_id = f"SES-{uuid.uuid4().hex[:8].upper()}"

        if not scenario_config:
            default_scen = ScenarioLoader.get_default_scenario()
            scenario_config = default_scen.model_dump()

        state_mgr = SimulationStateManager(session_id=session_id, scenario_config=scenario_config)

        # Hook WebSocket tick broadcast
        async def _broadcast_on_tick(sim_time: int) -> None:
            for role in (Role.COMMANDER, Role.UNIT_A, Role.UNIT_B, Role.INSTRUCTOR):
                projection = state_mgr.get_role_projection(role)
                await ws_manager.send_to_role(session_id, role, {
                    "type": "TICK",
                    "sim_time": sim_time,
                    "simTime": sim_time,
                    "payload": projection,
                })

        state_mgr.clock.register_tick_callback(_broadcast_on_tick)
        self.active_sessions[session_id] = state_mgr
        logger.info("Session created", session_id=session_id)
        return state_mgr

    def get_session(self, session_id: str) -> Optional[SimulationStateManager]:
        """Fetch session manager by ID."""
        return self.active_sessions.get(session_id)

    def get_or_create_default_session(self) -> SimulationStateManager:
        """Return the first active session or create a default one for quick start."""
        if self.active_sessions:
            return next(iter(self.active_sessions.values()))
        return self.create_session()

    async def control_clock(self, session_id: str, request: ClockControlRequest) -> ClockStatusResponse:
        """Handle clock control commands: start, pause, resume, step, multiplier."""
        state_mgr = self.get_session(session_id)
        if not state_mgr:
            raise KeyError(f"Session {session_id} not found")

        action = request.action.lower()
        if action == "start":
            await state_mgr.clock.start()
            state_mgr.status = SessionStatus.RUNNING
        elif action == "pause":
            await state_mgr.clock.pause()
            state_mgr.status = SessionStatus.PAUSED
        elif action == "resume":
            await state_mgr.clock.resume()
            state_mgr.status = SessionStatus.RUNNING
        elif action == "step":
            await state_mgr.clock.step(1)
        elif action == "stop":
            await state_mgr.clock.reset()
            state_mgr.status = SessionStatus.COMPLETED

        if request.time_multiplier:
            state_mgr.clock.set_multiplier(request.time_multiplier)

        # Broadcast state change to all clients
        await ws_manager.broadcast_session_event(session_id, {
            "type": "CLOCK_STATUS",
            "sim_time": state_mgr.clock.current_sim_time,
            "running": state_mgr.clock.is_running,
            "status": state_mgr.status.value,
        })

        return ClockStatusResponse(
            sim_time=state_mgr.clock.current_sim_time,
            clock_running=state_mgr.clock.is_running,
            time_multiplier=state_mgr.clock.time_multiplier,
            session_status=state_mgr.status,
        )

    async def submit_decision(self, session_id: str, decision: TraineeDecisionCreate) -> TraineeDecisionSchema:
        """Record trainee decision, persist to database, and notify clients."""
        state_mgr = self.get_session(session_id)
        if not state_mgr:
            raise KeyError(f"Session {session_id} not found")

        saved = state_mgr.submit_decision(decision)

        # Broadcast update to Instructor and Commander
        for r in (Role.COMMANDER, Role.INSTRUCTOR):
            await ws_manager.send_to_role(session_id, r, {
                "type": "DECISION_LOGGED",
                "decision": saved.model_dump(),
            })

        # Persist to database asynchronously
        try:
            from sqlalchemy import select
            from app.core.database import db_manager
            from app.models.tables import DecisionRationale as DBRationale
            from app.models.tables import SimulationSession as DBSession
            from app.models.tables import TraineeDecision as DBDecision

            if db_manager._initialized and db_manager.session_factory:
                async with db_manager.session_factory() as db_session:
                    stmt = select(DBSession).where(DBSession.session_code == session_id)
                    res = await db_session.execute(stmt)
                    db_sess = res.scalar_one_or_none()
                    if not db_sess:
                        db_sess = DBSession(
                            session_code=session_id,
                            status=state_mgr.status.value,
                            current_sim_time=state_mgr.clock.current_sim_time,
                        )
                        db_session.add(db_sess)
                        await db_session.flush()

                    db_dec = DBDecision(
                        session_id=db_sess.id,
                        user_id=decision.role.value,
                        role=decision.role.value,
                        sim_timestamp=decision.sim_timestamp,
                        action_type=decision.action.value,
                        target_entity=decision.target_entity_id,
                        confidence_score=int(decision.confidence_score),
                        decision_payload={
                            "action": decision.action.value,
                            "target": decision.target_entity_id,
                            "assumed_risk": decision.assumed_risk,
                        },
                    )
                    db_session.add(db_dec)
                    await db_session.flush()

                    db_rat = DBRationale(
                        decision_id=db_dec.id,
                        raw_notes=decision.rationale,
                        evidence_message_ids=decision.evidence_message_ids,
                        structured_reasons={"assumed_risk": decision.assumed_risk},
                    )
                    db_session.add(db_rat)
                    await db_session.commit()
        except Exception as e:
            logger.warn("Decision database persistence fallback", error=str(e))

        return saved

    async def submit_verification(
        self, session_id: str, request: VerificationRequestCreate, from_role: Role
    ) -> VerificationRequestSchema:
        """Record verification inquiry, persist to database, and return result."""
        state_mgr = self.get_session(session_id)
        if not state_mgr:
            raise KeyError(f"Session {session_id} not found")

        v = state_mgr.submit_verification(request, from_role)

        # Send response back to inquiring role and Instructor
        for r in (from_role, Role.INSTRUCTOR):
            await ws_manager.send_to_role(session_id, r, {
                "type": "VERIFICATION_UPDATE",
                "verification": v.model_dump(),
            })

        # Persist verification to database asynchronously
        try:
            from sqlalchemy import select
            from app.core.database import db_manager
            from app.models.tables import SimulationSession as DBSession
            from app.models.tables import TraineeVerification as DBVerification

            if db_manager._initialized and db_manager.session_factory:
                async with db_manager.session_factory() as db_session:
                    stmt = select(DBSession).where(DBSession.session_code == session_id)
                    res = await db_session.execute(stmt)
                    db_sess = res.scalar_one_or_none()
                    if not db_sess:
                        db_sess = DBSession(
                            session_code=session_id,
                            status=state_mgr.status.value,
                            current_sim_time=state_mgr.clock.current_sim_time,
                        )
                        db_session.add(db_sess)
                        await db_session.flush()

                    db_ver = DBVerification(
                        session_id=db_sess.id,
                        user_id=from_role.value,
                        from_role=from_role.value,
                        to_role=request.to_role.value,
                        target_entity=request.target_entity_id,
                        query_text=request.query,
                        response_text=v.response,
                        status=v.status,
                        sim_timestamp=v.sim_timestamp,
                    )
                    db_session.add(db_ver)
                    await db_session.commit()
        except Exception as e:
            logger.warn("Verification database persistence fallback", error=str(e))

        return v


# Global singleton instance
session_service = SessionService()
