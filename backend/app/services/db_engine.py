"""Database engine factory — builds SQLAlchemy engines for any supported db type."""

from __future__ import annotations

import logging
import re
from typing import Optional, Tuple

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def _quote_identifier(identifier: str, db_type: str) -> str:
    """Safely quote a SQL identifier (table/column name) to prevent injection.

    Different databases use different quoting characters.
    """
    # Validate: identifier must be alphanumeric with underscores only
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', identifier):
        raise ValueError(f"Invalid identifier: {identifier}")

    if db_type in ("postgresql",):
        return f'"{identifier}"'
    elif db_type in ("mysql",):
        return f"`{identifier}`"
    elif db_type in ("mssql",):
        return f"[{identifier}]"
    else:
        return f'"{identifier}"'


def build_connection_string(
    db_type: str,
    *,
    host: Optional[str] = None,
    port: Optional[int] = None,
    database: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    ssl_mode: str = "disable",
    http_path: Optional[str] = None,
    catalog: Optional[str] = None,
    access_token: Optional[str] = None,
) -> str:
    """Build a SQLAlchemy connection string for the given database type."""

    if db_type == "postgresql":
        ssl = f"?sslmode={ssl_mode}" if ssl_mode != "disable" else ""
        if password:
            return f"postgresql://{username}:{password}@{host}:{port or 5432}/{database}{ssl}"
        return f"postgresql://{username}@{host}:{port or 5432}/{database}{ssl}"

    elif db_type == "mysql":
        ssl = "?ssl=true" if ssl_mode == "require" else ""
        return f"mysql+pymysql://{username}:{password}@{host}:{port or 3306}/{database}{ssl}"

    elif db_type == "mssql":
        driver = "ODBC+Driver+17+for+SQL+Server"
        return (
            f"mssql+pyodbc://{username}:{password}@{host}:{port or 1433}/{database}"
            f"?driver={driver}&TrustServerCertificate=yes"
        )

    elif db_type == "databricks":
        token = access_token or ""
        return (
            f"databricks://token:{token}@{host}"
            f"?http_path={http_path or ''}&catalog={catalog or 'main'}"
        )

    else:
        raise ValueError(f"Unsupported database type: {db_type}")


def create_db_engine(
    db_type: str,
    **kwargs,
) -> Engine:
    """Create a SQLAlchemy engine for the given database type."""
    conn_str = build_connection_string(db_type, **kwargs)
    return create_engine(conn_str, pool_pre_ping=True)


def get_table_list_query(db_type: str) -> str:
    """Return the SQL query to list user tables for the given db type."""
    if db_type == "postgresql":
        return (
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        )
    elif db_type == "mysql":
        return (
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
        )
    elif db_type == "mssql":
        return (
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'dbo' AND table_type = 'BASE TABLE'"
        )
    elif db_type == "databricks":
        return "SHOW TABLES"
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


def get_default_schema(db_type: str) -> str:
    """Return the default schema name for the given db type."""
    if db_type == "postgresql":
        return "public"
    elif db_type == "mysql":
        return ""
    elif db_type == "mssql":
        return "dbo"
    elif db_type == "databricks":
        return "default"
    return "public"


def get_row_count_query(db_type: str, table_name: str) -> Tuple[Optional[str], dict]:
    """Return a fast row count estimate query with parameters, or (None, {}) if not supported.

    Returns a tuple of (query_template, params) for use with parameterized queries.
    The table name is validated to prevent SQL injection.
    """
    # Validate table name to prevent injection
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', table_name):
        logger.warning("Invalid table name rejected: %s", table_name)
        return None, {}

    if db_type == "postgresql":
        # PostgreSQL: use parameterized query for pg_class lookup
        return (
            "SELECT reltuples::bigint FROM pg_class WHERE relname = :table_name",
            {"table_name": table_name}
        )
    elif db_type == "mysql":
        # MySQL: use parameterized query for information_schema
        return (
            "SELECT table_rows FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = :table_name",
            {"table_name": table_name}
        )
    elif db_type == "mssql":
        # MSSQL: OBJECT_ID() cannot be parameterized, so we use validated identifier
        quoted = _quote_identifier(table_name, db_type)
        return (
            f"SELECT SUM(rows) FROM sys.partitions "
            f"WHERE object_id = OBJECT_ID({quoted}) AND index_id IN (0, 1)",
            {}
        )
    return None, {}
