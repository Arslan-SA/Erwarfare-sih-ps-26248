# backend/app/api/endpoints/websocket.py
"""WebSocket endpoint providing real-time bidirectional asymmetric tactical feeds."""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.logging import get_logger
from app.schemas.simulation import Role, TraineeDecisionCreate, VerificationRequestCreate
from app.services.session_service import session_service
from app.services.websocket_manager import ws_manager

logger = get_logger(__name__)
router = APIRouter(tags=["WebSocket"])


async def _handle_ws_lifecycle(websocket: WebSocket, session_id: str, role: Role) -> None:
    mgr = session_service.get_session(session_id)
    if not mgr:
        mgr = session_service.get_or_create_default_session()
        session_id = mgr.session_id

    await ws_manager.connect(websocket, session_id, role)

    # Send initial state snapshot immediately upon connection
    initial_projection = mgr.get_role_projection(role)
    await websocket.send_text(json.dumps({
        "type": "INITIAL_STATE",
        "sim_time": mgr.clock.current_sim_time,
        "simTime": mgr.clock.current_sim_time,
        "payload": initial_projection,
    }))

    try:
        while True:
            text = await websocket.receive_text()
            data = json.loads(text)
            action_type = data.get("type")

            if action_type == "PING":
                await websocket.send_text(json.dumps({"type": "PONG"}))

            elif action_type == "SUBMIT_DECISION":
                decision_payload = data.get("payload", {})
                decision_in = TraineeDecisionCreate(**decision_payload)
                await session_service.submit_decision(session_id, decision_in)

            elif action_type == "SUBMIT_VERIFICATION":
                req_payload = data.get("payload", {})
                verify_in = VerificationRequestCreate(**req_payload)
                await session_service.submit_verification(session_id, verify_in, from_role=role)

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, session_id, role)
    except Exception as e:
        logger.error("WebSocket runtime error", error=str(e), session_id=session_id, role=role.value)
        ws_manager.disconnect(websocket, session_id, role)


@router.websocket("/ws/{session_id}/{role}")
async def websocket_role_endpoint(websocket: WebSocket, session_id: str, role: Role) -> None:
    """Explicit role WebSocket endpoint."""
    await _handle_ws_lifecycle(websocket, session_id, role)


@router.websocket("/ws/session/{session_id}")
async def websocket_session_endpoint(
    websocket: WebSocket, session_id: str, token: Optional[str] = Query(default=None)
) -> None:
    """Frontend-compatible session WebSocket endpoint (defaults to COMMANDER role)."""
    await _handle_ws_lifecycle(websocket, session_id, Role.COMMANDER)
