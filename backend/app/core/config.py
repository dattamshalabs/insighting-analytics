"""Application configuration via pydantic-settings."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Primary PostgreSQL datasource (default) ---
    pg_host: str = "localhost"
    pg_port: int = 5432
    pg_database: str = "postgres"
    pg_username: str = "postgres"
    pg_password: str = ""
    pg_ssl_mode: str = "disable"

    # --- LLM (Ollama Cloud – FOSS) ---
    ollama_base_url: str = "https://ollama.com"
    ollama_model: str = "gpt-oss:120b-cloud"
    ollama_username: Optional[str] = None
    ollama_api_token: Optional[str] = None
    # Optional OpenAI-compatible fallback
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None

    # --- App ---
    chart_output_dir: str = "app/static/charts"
    cors_origins: List[str] = ["http://localhost:3000"]

    # --- Local metadata DB (SQLite) ---
    metadata_db_path: str = "insighting_meta.db"

    # --- Cache ---
    cache_ttl_seconds: int = 300  # 5 min
    cache_max_size: int = 256
    redis_url: Optional[str] = None  # optional; in-memory used if None

    # --- Scheduler ---
    scheduler_enabled: bool = True

    # --- Guardrails ---
    query_timeout_seconds: int = 30
    max_result_rows: int = 10_000
    pii_masking_enabled: bool = True

    # --- Encryption (Fernet key for datasource credentials) ---
    encryption_key: Optional[str] = None  # generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

    # --- SMTP (optional, admin-configurable via API) ---
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_use_tls: bool = True

    @property
    def pg_connection_string(self) -> str:
        ssl = f"?sslmode={self.pg_ssl_mode}" if self.pg_ssl_mode != "disable" else ""
        return (
            f"postgresql://{self.pg_username}:{self.pg_password}"
            f"@{self.pg_host}:{self.pg_port}/{self.pg_database}{ssl}"
        )

    @property
    def metadata_db_url(self) -> str:
        return f"sqlite:///{self.metadata_db_path}"


settings = Settings()
