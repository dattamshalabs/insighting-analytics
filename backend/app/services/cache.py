"""In-memory LRU + optional Redis caching for queries and LLM responses."""

from __future__ import annotations

import hashlib
import logging
from typing import Any, Optional

from cachetools import TTLCache

from app.core.config import settings

logger = logging.getLogger(__name__)

_query_cache: TTLCache = TTLCache(
    maxsize=settings.cache_max_size,
    ttl=settings.cache_ttl_seconds,
)

_llm_cache: TTLCache = TTLCache(
    maxsize=settings.cache_max_size,
    ttl=settings.cache_ttl_seconds * 2,  # LLM responses cached longer
)


def _make_key(*parts: str) -> str:
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Query result cache
# ---------------------------------------------------------------------------

def get_query_result(datasource_id: str, sql: str) -> Optional[Any]:
    key = _make_key(datasource_id, sql.strip().lower())
    result = _query_cache.get(key)
    if result is not None:
        logger.debug("Query cache HIT: %s", key[:12])
    return result


def set_query_result(datasource_id: str, sql: str, result: Any) -> None:
    key = _make_key(datasource_id, sql.strip().lower())
    _query_cache[key] = result
    logger.debug("Query cache SET: %s", key[:12])


# ---------------------------------------------------------------------------
# LLM response cache
# ---------------------------------------------------------------------------

def get_llm_response(prompt: str, model: str) -> Optional[str]:
    key = _make_key(prompt, model)
    return _llm_cache.get(key)


def set_llm_response(prompt: str, model: str, response: str) -> None:
    key = _make_key(prompt, model)
    _llm_cache[key] = response


# ---------------------------------------------------------------------------
# Management
# ---------------------------------------------------------------------------

def clear_all() -> None:
    _query_cache.clear()
    _llm_cache.clear()
    logger.info("All caches cleared")


def stats() -> dict:
    return {
        "query_cache_size": len(_query_cache),
        "query_cache_max": _query_cache.maxsize,
        "llm_cache_size": len(_llm_cache),
        "llm_cache_max": _llm_cache.maxsize,
    }
