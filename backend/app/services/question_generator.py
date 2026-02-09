"""Generate suggested analytical questions from database schema using LLM."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Dict, List, Optional, Tuple

from openai import OpenAI

from app.core.config import settings
from app.models.schemas import SuggestedQuestion

logger = logging.getLogger(__name__)

# In-memory cache: hash(sorted_table_names) -> (timestamp, questions)
_cache: Dict[str, Tuple[float, List[SuggestedQuestion]]] = {}
_CACHE_TTL = 1800  # 30 minutes


def _cache_key(table_names: List[str]) -> str:
    sorted_names = sorted(table_names)
    return hashlib.md5("|".join(sorted_names).encode()).hexdigest()


def _get_cached(key: str) -> Optional[List[SuggestedQuestion]]:
    if key in _cache:
        ts, questions = _cache[key]
        if time.time() - ts < _CACHE_TTL:
            return questions
        del _cache[key]
    return None


def generate_questions(
    table_names: List[str],
    schema_summary: str,
) -> List[SuggestedQuestion]:
    """Generate 6 analytical questions from the schema using LLM."""
    key = _cache_key(table_names)
    cached = _get_cached(key)
    if cached:
        logger.info("Returning cached suggested questions")
        return cached

    prompt = f"""You are a data analyst. Given the following database schema, generate exactly 6 insightful analytical questions that a business user might ask.

{schema_summary}

Requirements:
- Each question should be a natural-language question a business user would ask
- Cover different analysis types: trend analysis, comparisons, distributions, rankings, anomalies, and correlations
- Reference actual table and column names from the schema
- Keep questions concise (under 15 words each)

Return ONLY a JSON array with exactly 6 objects. Each object must have:
- "text": the question string
- "category": one of "trend", "comparison", "distribution", "ranking", "anomaly", "correlation"
- "icon_hint": one of "chart", "table", "search", "bolt"

Map categories to icons:
- trend -> chart
- comparison -> chart
- distribution -> chart
- ranking -> table
- anomaly -> bolt
- correlation -> search

Return ONLY the JSON array, no other text."""

    try:
        client = OpenAI(
            base_url=f"{settings.ollama_base_url}/v1",
            api_key=settings.ollama_api_token or "dummy",
        )
        resp = client.chat.completions.create(
            model=settings.ollama_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        content = resp.choices[0].message.content or "[]"

        # Extract JSON array from response
        content = content.strip()
        # Handle markdown code blocks
        if content.startswith("```"):
            lines = content.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            content = "\n".join(lines)

        raw = json.loads(content)
        questions = []
        for item in raw[:6]:
            questions.append(SuggestedQuestion(
                text=item.get("text", ""),
                category=item.get("category", "trend"),
                icon_hint=item.get("icon_hint", "chart"),
            ))

        if questions:
            _cache[key] = (time.time(), questions)
            logger.info("Generated %d suggested questions", len(questions))
            return questions

    except Exception as e:
        logger.warning("Failed to generate suggested questions: %s", e)

    return _fallback_questions()


def _fallback_questions() -> List[SuggestedQuestion]:
    """Return generic fallback questions when LLM is unavailable."""
    return [
        SuggestedQuestion(text="Show me total revenue by month", category="trend", icon_hint="chart"),
        SuggestedQuestion(text="What are the top 10 customers by order count?", category="ranking", icon_hint="table"),
        SuggestedQuestion(text="Compare sales this quarter vs last quarter", category="comparison", icon_hint="chart"),
        SuggestedQuestion(text="Find anomalies in recent transactions", category="anomaly", icon_hint="bolt"),
        SuggestedQuestion(text="What is the average attrition rate by department?", category="distribution", icon_hint="chart"),
        SuggestedQuestion(text="Show employee performance rating distribution", category="distribution", icon_hint="chart"),
    ]
