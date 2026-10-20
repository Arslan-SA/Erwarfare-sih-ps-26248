# backend/app/core/config.py
"""Centralized application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "SIH26248 Decision Trainer"
    DEBUG: bool = True

    # PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/sih26248"

    # Redis (optional – fallback to in-memory queues)
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT Authentication
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 15  # seconds

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
