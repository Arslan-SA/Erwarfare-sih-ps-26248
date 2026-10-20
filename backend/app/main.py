# backend/app/main.py
"""FastAPI application entrypoint for SIH-26248 Immersive Multi-Domain Decision Trainer."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints.websocket import router as ws_router
from app.api.router import api_router
from app.core.config import settings
from app.core.database import db_manager
from app.core.logging import get_logger, setup_logging
from app.services.session_service import session_service

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle."""
    setup_logging(debug=settings.DEBUG)
    logger.info("Initializing SIH-26248 Backend Application", env="development" if settings.DEBUG else "production")

    # Initialize authoritative database (Supabase PostgreSQL / local SQLite fallback)
    await db_manager.initialize()
    logger.info("Database initialized and verified", db_type=db_manager.database_type)

    # Pre-seed a default session so the system is ready immediately
    default_session = session_service.get_or_create_default_session()
    logger.info("Default simulation session pre-warmed", session_id=default_session.session_id)

    yield

    logger.info("Shutting down SIH-26248 Backend Application")


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend microservices for Immersive Multi-Domain Decision-Making Trainer under Degraded Conditions",
    version="0.1.0",
    lifespan=lifespan,
)

# Cross-Origin Resource Sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(api_router, prefix="/api")
app.include_router(ws_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Liveness probe."""
    return {
        "status": "HEALTHY",
        "app": settings.APP_NAME,
        "database": db_manager.database_type,
    }


@app.get("/api/system/database-status")
async def get_database_status() -> dict[str, Any]:
    """Introspection endpoint for database connectivity, active engine, and table status."""
    return await db_manager.get_status()
