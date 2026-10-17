# backend/app/api/router.py
"""Central API Router aggregating all sub-routers."""

from fastapi import APIRouter

from app.api.endpoints import aar, decision, instructor, scenario, session, websocket

api_router = APIRouter()

api_router.include_router(scenario.router)
api_router.include_router(session.router)
api_router.include_router(decision.router)
api_router.include_router(instructor.router)
api_router.include_router(aar.router)
api_router.include_router(websocket.router)
