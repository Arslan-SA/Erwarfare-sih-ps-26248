# backend/app/core/database.py
"""Database engine & session management supporting Supabase / PostgreSQL and SQLite.

Features:
- Seamless Supabase PostgreSQL connection with SSL support
- Automatic fallback to stabilized local SQLite if Supabase/Postgres is offline
- Automatic schema creation & pre-seeding of military operator accounts
- Live database health and status introspection
"""

from __future__ import annotations

import os
from typing import Any, AsyncGenerator

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


class DatabaseManager:
    """Manages active database connection, dialect detection, and auto-fallback."""

    def __init__(self) -> None:
        self.engine: Any = None
        self.session_factory: Any = None
        self.database_type: str = "UNKNOWN"
        self.active_url: str = ""
        self._initialized: bool = False

    def _determine_target_url(self) -> tuple[str, dict[str, Any]]:
        """Resolve database URL and dialect connection arguments."""
        # 1. Check explicit Supabase Database URL first
        raw_url = (
            settings.SUPABASE_DB_URL.strip()
            or settings.DATABASE_URL.strip()
            or "sqlite+aiosqlite:///sih26248.db"
        )

        # Normalize postgres protocol for asyncpg
        if raw_url.startswith("postgres://"):
            raw_url = "postgresql+asyncpg://" + raw_url[len("postgres://"):]
        elif raw_url.startswith("postgresql://"):
            raw_url = "postgresql+asyncpg://" + raw_url[len("postgresql://"):]

        connect_args: dict[str, Any] = {}

        # Configure SSL for Supabase hosted instances
        if "supabase.co" in raw_url or "pooler.supabase.com" in raw_url or "sslmode=require" in raw_url:
            connect_args["ssl"] = True

        return raw_url, connect_args

    async def initialize(self) -> None:
        """Initialize engine, test connection, fallback to SQLite if needed, and run migrations."""
        if self._initialized and self.engine is not None:
            return

        target_url, connect_args = self._determine_target_url()
        is_postgres = target_url.startswith("postgresql")

        if is_postgres:
            try:
                test_engine = create_async_engine(
                    target_url,
                    echo=False,
                    pool_pre_ping=True,
                    connect_args=connect_args,
                )
                async with test_engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))

                self.engine = test_engine
                self.database_type = "SUPABASE_POSTGRESQL" if "supabase" in target_url.lower() else "POSTGRESQL"
                self.active_url = target_url
                logger.info(
                    "Connected to remote PostgreSQL database",
                    db_type=self.database_type,
                    target=target_url.split("@")[-1] if "@" in target_url else "configured",
                )
            except Exception as e:
                logger.warn(
                    "PostgreSQL/Supabase connection failed; falling back to local SQLite",
                    error=str(e),
                )
                if not settings.DATABASE_FALLBACK_SQLITE:
                    raise

                sqlite_url = "sqlite+aiosqlite:///sih26248.db"
                self.engine = create_async_engine(sqlite_url, echo=False)
                self.database_type = "SQLITE"
                self.active_url = sqlite_url
        else:
            self.engine = create_async_engine(target_url, echo=False)
            self.database_type = "SQLITE"
            self.active_url = target_url

        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

        # Auto-create all tables
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Seed pre-configured user accounts
        await self._seed_default_accounts()

        self._initialized = True
        logger.info("Database schema initialized and verified", db_type=self.database_type)

    async def _seed_default_accounts(self) -> None:
        """Seed the 4 mandatory operational stations and backward-compatible aliases."""
        from app.core.security import hash_password
        from app.models.tables import UserAccount

        DEFAULT_ACCOUNTS = [
            {
                "service_id": "CDR-NAV-8821",
                "call_sign": "CDR. A. VERMA (TASK FORCE CDR)",
                "role": "COMMANDER",
                "password": "COMMANDER-2026",
                "clearance_level": "LEVEL 4 // TOP SECRET (HEADQUARTERS C2 AUTHORITY)",
                "station_title": "Task Force Commander Station",
                "station_description": "Strategic air-sea fused picture, intel feed verification, cross-examination dispatch, structured decision authority.",
            },
            {
                "service_id": "FAD-AIR-4012",
                "call_sign": "LT. CDR. S. NAIR (AIR PICKET)",
                "role": "UNIT_A",
                "password": "UNIT-A-2026",
                "clearance_level": "LEVEL 3 // SECRET (FORWARD AIR DEFENSE PICKET)",
                "station_title": "Unit A: Forward Air Defense Picket",
                "station_description": "Forward surveillance radar sweep, electro-optical contacts, track signature reporting, subordinate observations.",
            },
            {
                "service_id": "ESM-SEA-7109",
                "call_sign": "LT. K. JOSHI (COASTAL RADAR)",
                "role": "UNIT_B",
                "password": "UNIT-B-2026",
                "clearance_level": "LEVEL 3 // SECRET (MARITIME ESM & AIS SURVEILLANCE)",
                "station_title": "Unit B: Maritime ESM & AIS Post",
                "station_description": "Civilian AIS transponder tracking, SIGINT/ESM intercepts, shipping registry correlation, ambiguity resolution.",
            },
            {
                "service_id": "INST-CTRL-001",
                "call_sign": "CAPT. R. MENON (EXERCISE CONTROLLER)",
                "role": "INSTRUCTOR",
                "password": "DEFENSE-C4I-LEAD",
                "clearance_level": "LEVEL 5 // COSMIC TOP SECRET (EXERCISE CONTROLLER)",
                "station_title": "Lead Instructor / Exercise Controller",
                "station_description": "Authoritative ground truth, dynamic EW jamming injection, link severing, telemetry monitoring, forensic AAR grading.",
            },
            # Compatibility aliases for legacy prototype credentials
            {
                "service_id": "NAV-8821",
                "call_sign": "CDR. A. VERMA",
                "role": "COMMANDER",
                "password": "COMMANDER-2026",
                "clearance_level": "LEVEL 4 // TOP SECRET",
                "station_title": "Task Force Commander",
                "station_description": "Strategic C2 station.",
            },
            {
                "service_id": "AIR-4012",
                "call_sign": "LT. CDR. S. NAIR",
                "role": "UNIT_A",
                "password": "UNIT-A-2026",
                "clearance_level": "LEVEL 3 // SECRET",
                "station_title": "Unit A Station",
                "station_description": "Air defense radar.",
            },
            {
                "service_id": "SEA-7109",
                "call_sign": "LT. K. JOSHI",
                "role": "UNIT_B",
                "password": "UNIT-B-2026",
                "clearance_level": "LEVEL 3 // SECRET",
                "station_title": "Unit B Station",
                "station_description": "Coastal radar post.",
            },
            {
                "service_id": "INST-ROOT",
                "call_sign": "CAPT. R. MENON (CHIEF CONTROLLER)",
                "role": "INSTRUCTOR",
                "password": "DEFENSE-C4I-LEAD",
                "clearance_level": "LEVEL 5 // COSMIC TOP SECRET",
                "station_title": "Master Controller",
                "station_description": "Lead instructor console.",
            },
        ]

        async with self.session_factory() as session:
            for acc in DEFAULT_ACCOUNTS:
                stmt = select(UserAccount).where(UserAccount.service_id == acc["service_id"])
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()
                if not existing:
                    user = UserAccount(
                        service_id=acc["service_id"],
                        call_sign=acc["call_sign"],
                        role=acc["role"],
                        password_hash=hash_password(acc["password"]),
                        clearance_level=acc["clearance_level"],
                        station_title=acc["station_title"],
                        station_description=acc["station_description"],
                        is_active=True,
                    )
                    session.add(user)
            await session.commit()

    async def get_status(self) -> dict[str, Any]:
        """Return diagnostic health and connectivity information."""
        from app.models.tables import UserAccount

        account_count = 0
        is_healthy = False
        try:
            async with self.session_factory() as session:
                res = await session.execute(select(UserAccount))
                account_count = len(res.scalars().all())
                is_healthy = True
        except Exception:
            is_healthy = False

        # Redact active URL credentials
        redacted = self.active_url
        if "@" in redacted:
            prefix = redacted.split("@")[0].split("://")[0]
            host_part = redacted.split("@")[-1]
            redacted = f"{prefix}://***:***@{host_part}"

        return {
            "status": "HEALTHY" if is_healthy else "DEGRADED",
            "database_type": self.database_type,
            "active_url": redacted,
            "supabase_configured": bool(settings.SUPABASE_DB_URL or settings.SUPABASE_URL),
            "registered_accounts": account_count,
            "tables_registered": len(Base.metadata.tables),
        }


db_manager = DatabaseManager()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session."""
    if not db_manager._initialized:
        await db_manager.initialize()

    async with db_manager.session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
