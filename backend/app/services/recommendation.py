"""Post-analysis action recommendation engine using Ollama LLM."""

from __future__ import annotations

import json
import logging
from typing import List

import httpx

from app.core.config import settings
from app.models.schemas import Recommendation

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a data analytics advisor. Given an analysis result, generate 1-3 actionable business recommendations.
Return ONLY a JSON array where each item has:
- "action": short imperative statement
- "rationale": why this matters
- "expected_impact": what improvement to expect
- "confidence": 0.0-1.0
- "priority": "high", "medium", or "low"

Return valid JSON only, no markdown."""


async def generate_recommendations(
    analysis_text: str,
    query: str,
    generated_sql: str | None = None,
) -> List[Recommendation]:
    """Call Ollama to generate action recommendations from analysis."""
    user_content = f"User question: {query}\n"
    if generated_sql:
        user_content += f"SQL executed: {generated_sql}\n"
    user_content += f"Analysis result:\n{analysis_text}"

    try:
        payload = {
            "model": settings.ollama_model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.3},
        }

        headers = {}
        if settings.ollama_api_token:
            headers["Authorization"] = f"Bearer {settings.ollama_api_token}"

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data.get("message", {}).get("content", "[]")
        parsed = json.loads(content)

        # Handle both {"recommendations": [...]} and [...]
        if isinstance(parsed, dict):
            items = parsed.get("recommendations", parsed.get("items", []))
        elif isinstance(parsed, list):
            items = parsed
        else:
            items = []

        return [Recommendation(**item) for item in items[:3]]

    except Exception as e:
        logger.warning("Recommendation generation failed: %s", e)
        return []
