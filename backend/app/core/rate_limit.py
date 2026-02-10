"""Rate limiting configuration using slowapi."""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# Global limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri="memory://",
)


def get_limiter() -> Limiter:
    """Get the configured rate limiter instance."""
    return limiter
