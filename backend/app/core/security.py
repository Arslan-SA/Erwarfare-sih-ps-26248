# backend/app/core/security.py
"""Cryptographic security utilities for authentication and password management."""

from __future__ import annotations

import hashlib
import hmac
import os


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with random 16-byte salt."""
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return f"pbkdf2:sha256:100000${salt}${key}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against PBKDF2 hash or plain string fallback."""
    if not hashed_password:
        return False
    try:
        parts = hashed_password.split("$")
        if len(parts) == 3:
            _, salt, key = parts
            computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
            return hmac.compare_digest(computed, key)
        # Direct comparison fallback if unhashed dev string
        return hmac.compare_digest(plain_password, hashed_password)
    except Exception:
        return False
