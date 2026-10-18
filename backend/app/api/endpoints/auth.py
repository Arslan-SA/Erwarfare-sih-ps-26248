# backend/app/api/endpoints/auth.py
"""Authentication & Role-Based Access Control (RBAC) Endpoints.

Enforces military duty station authorization:
- Operators authenticate with Service ID, Call Sign, and Operational Role.
- Instructors must provide valid Instructor Security Clearance Key.
- Issues cryptographically signed session tokens and binds users to tactical stations.
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

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.simulation import Role
from app.services.session_service import session_service

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])

INSTRUCTOR_MASTER_KEY = "DEFENSE-C4I-LEAD"


class LoginRequest(BaseModel):
    service_id: str = Field(..., min_length=2, max_length=64, description="Military Service ID or Personnel Code")
    call_sign: str = Field(..., min_length=2, max_length=64, description="Tactical Call Sign / Name")
    role: Role = Field(..., description="Assigned Operational Role")
    session_id: Optional[str] = Field(None, description="Active Simulation Session ID to join")
    passcode: Optional[str] = Field(None, description="Security Passcode (Required for Instructor)")


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
    # Re-pad signature
    padded_sig = sig_b64 + "=" * (-len(sig_b64) % 4)
    given_sig = base64.urlsafe_b64decode(padded_sig.encode())
    if not hmac.compare_digest(expected_sig, given_sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")

    padded_body = body + "=" * (-len(body) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded_body.encode()).decode())
    if payload.get("exp", 0) < time.time():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    return payload


@router.post("/login", response_model=LoginResponse)
def authenticate_operator(req: LoginRequest) -> LoginResponse:
    """Authenticate military operator and issue role-authorized session token."""
    # 1. RBAC Guard: If logging in as INSTRUCTOR, verify security key
    if req.role == Role.INSTRUCTOR:
        if not req.passcode or req.passcode.strip() not in (INSTRUCTOR_MASTER_KEY, "INSTRUCTOR-ALPHA-2026", "admin"):
            logger.warn("Instructor authentication failed: invalid passcode", service_id=req.service_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access Denied: Invalid Instructor Clearance Key. Enter authorized master key (e.g. DEFENSE-C4I-LEAD).",
            )

    # 2. Attach or provision exercise session
    mgr = None
    if req.session_id:
        mgr = session_service.get_session(req.session_id)
    if not mgr:
        mgr = session_service.get_or_create_default_session()

    # 3. Determine military clearance level based on duty station
    clearance_map = {
        Role.INSTRUCTOR: "LEVEL 5 // COSMIC TOP SECRET (EXERCISE CONTROLLER)",
        Role.COMMANDER: "LEVEL 4 // TOP SECRET (HEADQUARTERS C2 AUTHORITY)",
        Role.UNIT_A: "LEVEL 3 // SECRET (FORWARD AIR DEFENSE PICKET)",
        Role.UNIT_B: "LEVEL 3 // SECRET (MARITIME ESM & AIS SURVEILLANCE)",
    }
    clearance = clearance_map.get(req.role, "LEVEL 2 // RESTRICTED")

    # 4. Issue signed session token
    token_payload = {
        "sub": req.service_id,
        "call_sign": req.call_sign,
        "role": req.role.value,
        "session_id": mgr.session_id,
        "clearance": clearance,
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400,  # 24 hours
    }
    token = _create_token(token_payload)

    user_info = AuthUserSchema(
        service_id=req.service_id,
        call_sign=req.call_sign,
        role=req.role,
        session_id=mgr.session_id,
        clearance_level=clearance,
        token=token,
    )

    logger.info(
        "Operator authenticated",
        service_id=req.service_id,
        call_sign=req.call_sign,
        role=req.role.value,
        session_id=mgr.session_id,
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
