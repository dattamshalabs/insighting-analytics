"""Read-only enforcement, query timeout, row caps, PII masking."""

from __future__ import annotations

import re
from typing import Optional

from app.core.config import settings

# ---------------------------------------------------------------------------
# SQL guardrails
# ---------------------------------------------------------------------------

_DANGEROUS_KEYWORDS = re.compile(
    r"\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|CREATE|GRANT|REVOKE)\b",
    re.IGNORECASE,
)


def validate_sql_readonly(sql: str) -> None:
    """Raise if SQL contains write/DDL statements."""
    match = _DANGEROUS_KEYWORDS.search(sql)
    if match:
        raise PermissionError(
            f"Query blocked: statement contains disallowed keyword '{match.group()}'. "
            "Only read-only queries are permitted."
        )


def inject_row_limit(sql: str, limit: Optional[int] = None) -> str:
    """Append LIMIT clause if the query lacks one."""
    cap = limit or settings.max_result_rows
    stripped = sql.rstrip().rstrip(";")
    if not re.search(r"\bLIMIT\b", stripped, re.IGNORECASE):
        stripped += f" LIMIT {cap}"
    return stripped


def pg_connection_options() -> dict:
    """Extra connection options for guardrails."""
    return {
        "options": f"-c statement_timeout={settings.query_timeout_seconds * 1000}",
    }


# ---------------------------------------------------------------------------
# PII masking
# ---------------------------------------------------------------------------

_PII_PATTERNS = [
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "[EMAIL]"),
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[SSN]"),
    (re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"), "[PHONE]"),
]


def mask_pii(text: str) -> str:
    """Replace PII patterns in text with placeholders."""
    if not settings.pii_masking_enabled:
        return text
    for pattern, replacement in _PII_PATTERNS:
        text = pattern.sub(replacement, text)
    return text
