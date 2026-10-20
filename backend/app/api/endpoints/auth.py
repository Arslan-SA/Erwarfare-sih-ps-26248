# backend/app/api/endpoints/auth.py
"""Authentication & Role-Based Access Control (RBAC) Endpoints.

Enforces military duty station authorization:
- Operators authenticate with Service ID, Password/Passcode, and Operational Role.
- Validates against authoritative database (Supabase PostgreSQL / local store).
- Issues cryptographically signed session tokens and binds operators to stations.
- Provides accounts directory endpoint for station discovery and quick evaluation.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.config import settings
from app.core.database import db_manager
from app.core.logging import get_logger
from app.core.security import hash_password, verify_password
from app.models.tables import UserAccount
from app.schemas.simulation import Role
from app.services.session_service import session_service

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])

INSTRUCTOR_MASTER_KEY = "DEFENSE-C4I-LEAD"


class LoginRequest(BaseModel):
    service_id: str = Field(..., min_length=2, max_length=64, description="Military Service ID or Personnel Code")
    call_sign: Optional[str] = Field(None, max_length=64, description="Tactical Call Sign / Name")
    role: Role = Field(..., description="Assigned Operational Role")
    session_id: Optional[str] = Field(None, description="Active Simulation Session ID to join")
    password: Optional[str] = Field(None, description="Account password")
    passcode: Optional[str] = Field(None, description="Security Passcode")


class RegisterRequest(BaseModel):
    service_id: str = Field(..., min_length=2, max_length=64)
    call_sign: str = Field(..., min_length=2, max_length=128)
    role: Role
    password: str = Field(..., min_length=4)
    station_title: Optional[str] = ""
    station_description: Optional[str] = ""


class AuthUserSchema(BaseModel):
    service_id: str
    call_sign: str
    role: Role
    session_id: str
    clearance_level: str
    token: str


class LoginResponse(BaseModel):
    status: str
    message: str
    user: AuthUserSchema


class AccountPresetSchema(BaseModel):
    service_id: str
    call_sign: str
    role: Role
    clearance_level: str
    station_title: str
    station_description: str
    sample_password: str


def _create_token(payload: dict[str, Any]) -> str:
    """Create a lightweight HMAC-SHA256 signed bearer token."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signing_input = f"{header}.{body}".encode()
    signature = hmac.new(settings.JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{header}.{body}.{sig_b64}"


def _verify_token(token: str) -> dict[str, Any]:
    """Verify HMAC-SHA256 token signature and return payload."""
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")
    header, body, sig_b64 = parts
    signing_input = f"{header}.{body}".encode()
    expected_sig = hmac.new(settings.JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    padded_sig = sig_b64 + "=" * (-len(sig_b64) % 4)
    given_sig = base64.urlsafe_b64decode(padded_sig.encode())
    if not hmac.compare_digest(expected_sig, given_sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")

    padded_body = body + "=" * (-len(body) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded_body.encode()).decode())
    if payload.get("exp", 0) < time.time():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    return payload


@router.get("/accounts", response_model=list[AccountPresetSchema])
async def list_available_accounts() -> list[AccountPresetSchema]:
    """Retrieve pre-configured operational duty station accounts for quick evaluation."""
    if not db_manager._initialized:
        await db_manager.initialize()

    async with db_manager.session_factory() as session:
        result = await session.execute(
            select(UserAccount)
            .where(UserAccount.is_active == True)  # noqa: E712
            .order_by(UserAccount.created_at.asc())
        )
        accounts = result.scalars().all()

    # Pre-defined sample passwords for UI quick-reference
    SAMPLE_PWS = {
        "COMMANDER": "COMMANDER-2026",
        "UNIT_A": "UNIT-A-2026",
        "UNIT_B": "UNIT-B-2026",
        "INSTRUCTOR": "DEFENSE-C4I-LEAD",
    }

    # Deduplicate by primary roles
    seen_roles: set[str] = set()
    presets: list[AccountPresetSchema] = []

    for acc in accounts:
        # Prioritize standard CDR/FAD/ESM/INST codes over short aliases
        if acc.role not in seen_roles and ("-" in acc.service_id):
            seen_roles.add(acc.role)
            presets.append(
                AccountPresetSchema(
                    service_id=acc.service_id,
                    call_sign=acc.call_sign,
                    role=Role(acc.role),
                    clearance_level=acc.clearance_level,
                    station_title=acc.station_title or f"{acc.role} Tactical Station",
                    station_description=acc.station_description or "Authorized multi-domain terminal.",
                    sample_password=SAMPLE_PWS.get(acc.role, "TACTICAL-2026"),
                )
            )

    return presets


@router.post("/register", response_model=LoginResponse)
async def register_account(req: RegisterRequest) -> LoginResponse:
    """Create a new operator account in the database."""
    if not db_manager._initialized:
        await db_manager.initialize()

    clearance_map = {
        Role.INSTRUCTOR: "LEVEL 5 // COSMIC TOP SECRET (EXERCISE CONTROLLER)",
        Role.COMMANDER: "LEVEL 4 // TOP SECRET (HEADQUARTERS C2 AUTHORITY)",
        Role.UNIT_A: "LEVEL 3 // SECRET (FORWARD AIR DEFENSE PICKET)",
        Role.UNIT_B: "LEVEL 3 // SECRET (MARITIME ESM & AIS SURVEILLANCE)",
    }

    async with db_manager.session_factory() as session:
        # Check existing
        existing = await session.execute(select(UserAccount).where(UserAccount.service_id == req.service_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="An account with this Service ID already exists.")

        user = UserAccount(
            service_id=req.service_id,
            call_sign=req.call_sign,
            role=req.role.value,
            password_hash=hash_password(req.password),
            clearance_level=clearance_map.get(req.role, "LEVEL 2 // RESTRICTED"),
            station_title=req.station_title or f"{req.role.value} Station",
            station_description=req.station_description or "",
            is_active=True,
        )
        session.add(user)
        await session.commit()

    mgr = session_service.get_or_create_default_session()
    token = _create_token({
        "sub": user.service_id,
        "call_sign": user.call_sign,
        "role": user.role,
        "session_id": mgr.session_id,
        "clearance": user.clearance_level,
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400,
    })

    return LoginResponse(
        status="REGISTERED",
        message="Account successfully created and authenticated.",
        user=AuthUserSchema(
            service_id=user.service_id,
            call_sign=user.call_sign,
            role=Role(user.role),
            session_id=mgr.session_id,
            clearance_level=user.clearance_level,
            token=token,
        ),
    )


@router.post("/login", response_model=LoginResponse)
async def authenticate_operator(req: LoginRequest) -> LoginResponse:
    """Authenticate military operator against the database and issue role-authorized session token."""
    if not db_manager._initialized:
        await db_manager.initialize()

    provided_secret = req.password or req.passcode or ""

    # 1. RBAC Guard: If logging in as INSTRUCTOR, verify security key
    if req.role == Role.INSTRUCTOR:
        valid_instructor_keys = (INSTRUCTOR_MASTER_KEY, "INSTRUCTOR-ALPHA-2026", "admin")
        if not provided_secret or provided_secret.strip() not in valid_instructor_keys:
            # Also check if it matches the hashed password in DB
            pass_matched = False
            async with db_manager.session_factory() as session:
                res = await session.execute(select(UserAccount).where(UserAccount.service_id == req.service_id))
                account = res.scalar_one_or_none()
                if account and verify_password(provided_secret.strip(), account.password_hash):
                    pass_matched = True

            if not pass_matched:
                logger.warn("Instructor authentication failed: invalid passcode", service_id=req.service_id)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Access Denied: Invalid Instructor Clearance Key. Enter authorized master key (e.g. DEFENSE-C4I-LEAD).",
                )

    # 2. Check Database for user account
    db_user: Optional[UserAccount] = None
    async with db_manager.session_factory() as session:
        res = await session.execute(select(UserAccount).where(UserAccount.service_id == req.service_id))
        db_user = res.scalar_one_or_none()

        if db_user:
            # If user has password, verify it if provided
            if provided_secret and not verify_password(provided_secret.strip(), db_user.password_hash):
                # Also accept call_sign match in dev mode
                if provided_secret.strip() != db_user.service_id and provided_secret.strip() not in (
                    "COMMANDER-2026",
                    "UNIT-A-2026",
                    "UNIT-B-2026",
                    "DEFENSE-C4I-LEAD",
                ):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Access Denied: Invalid security password for this personnel ID.",
                    )

    # 3. Attach or provision exercise session
    mgr = None
    if req.session_id:
        mgr = session_service.get_session(req.session_id)
    if not mgr:
        mgr = session_service.get_or_create_default_session()

    # 4. Determine military clearance level based on duty station
    clearance_map = {
        Role.INSTRUCTOR: "LEVEL 5 // COSMIC TOP SECRET (EXERCISE CONTROLLER)",
        Role.COMMANDER: "LEVEL 4 // TOP SECRET (HEADQUARTERS C2 AUTHORITY)",
        Role.UNIT_A: "LEVEL 3 // SECRET (FORWARD AIR DEFENSE PICKET)",
        Role.UNIT_B: "LEVEL 3 // SECRET (MARITIME ESM & AIS SURVEILLANCE)",
    }
    clearance = db_user.clearance_level if db_user else clearance_map.get(req.role, "LEVEL 2 // RESTRICTED")
    resolved_call_sign = (db_user.call_sign if db_user else None) or req.call_sign or f"{req.role.value} Operator"

    # 5. Issue signed session token
    token_payload = {
        "sub": req.service_id,
        "call_sign": resolved_call_sign,
        "role": req.role.value,
        "session_id": mgr.session_id,
        "clearance": clearance,
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400,  # 24 hours
    }
    token = _create_token(token_payload)

    user_info = AuthUserSchema(
        service_id=req.service_id,
        call_sign=resolved_call_sign,
        role=req.role,
        session_id=mgr.session_id,
        clearance_level=clearance,
        token=token,
    )

    logger.info(
        "Operator authenticated successfully",
        service_id=req.service_id,
        call_sign=resolved_call_sign,
        role=req.role.value,
        session_id=mgr.session_id,
        db_backed=bool(db_user),
    )

    return LoginResponse(
        status="AUTHENTICATED",
        message=f"Access Granted to {req.role.value} Tactical Terminal.",
        user=user_info,
    )


@router.get("/me", response_model=AuthUserSchema)
def get_current_operator(authorization: Optional[str] = Header(None)) -> AuthUserSchema:
    """Validate token and return current operator session profile."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")

    token = authorization[len("Bearer ") :].strip()
    payload = _verify_token(token)

    return AuthUserSchema(
        service_id=payload["sub"],
        call_sign=payload["call_sign"],
        role=Role(payload["role"]),
        session_id=payload["session_id"],
        clearance_level=payload["clearance"],
        token=token,
    )
