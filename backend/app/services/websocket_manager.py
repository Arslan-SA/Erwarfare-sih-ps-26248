# backend/app/services/websocket_manager.py
"""WebSocket Connection Manager for Asymmetric Multi-Domain Broadcasting."""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.core.logging import get_logger
from app.schemas.simulation import Role

logger = get_logger(__name__)


class WebSocketManager:
    """Manages active WebSocket connections grouped by session_id and role."""

    def __init__(self) -> None:
        # session_id -> role -> set of WebSocket instances
        self.active_connections: dict[str, dict[str, set[WebSocket]]] = defaultdict(
            lambda: defaultdict(set)
        )

    async def connect(self, websocket: WebSocket, session_id: str, role: Role) -> None:
        """Accept and register a new client connection."""
        await websocket.accept()
        self.active_connections[session_id][role.value].add(websocket)
        logger.info("WebSocket connected", session_id=session_id, role=role.value)

    def disconnect(self, websocket: WebSocket, session_id: str, role: Role) -> None:
        """Unregister a client connection."""
        role_conns = self.active_connections.get(session_id, {}).get(role.value, set())
        role_conns.discard(websocket)
        if not role_conns and role.value in self.active_connections.get(session_id, {}):
            del self.active_connections[session_id][role.value]
        logger.info("WebSocket disconnected", session_id=session_id, role=role.value)

    async def send_to_role(self, session_id: str, role: Role, data: dict[str, Any]) -> None:
        """Send message only to clients subscribed to a specific role in a session."""
        sockets = list(self.active_connections.get(session_id, {}).get(role.value, set()))
        if not sockets:
            return

        payload = json.dumps(data)
        stale_sockets: list[WebSocket] = []

        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warn("Failed sending to client websocket", error=str(e), role=role.value)
                stale_sockets.append(ws)

        for stale in stale_sockets:
            self.disconnect(stale, session_id, role)

    async def broadcast_session_event(self, session_id: str, data: dict[str, Any]) -> None:
        """Broadcast general event to all roles connected to a session."""
        roles_dict = self.active_connections.get(session_id, {})
        for role_str, sockets in list(roles_dict.items()):
            role = Role(role_str)
            await self.send_to_role(session_id, role, data)


# Global singleton manager
ws_manager = WebSocketManager()
