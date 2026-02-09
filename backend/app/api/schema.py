"""GET schema introspection + inferred relations + suggested questions."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.orm import Datasource
from app.models.schemas import SchemaMap, SuggestedQuestionsResponse
from app.services import schema_registry
from app.services.question_generator import generate_questions

router = APIRouter(prefix="/schema", tags=["schema"])


# NOTE: This route MUST be before /{datasource_id} to avoid being swallowed
@router.get("/suggested-questions", response_model=SuggestedQuestionsResponse)
async def suggested_questions(
    datasource_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Generate dynamic suggested questions based on the database schema."""
    schema_summary = ""
    table_names: list[str] = []

    if datasource_id:
        # Use the cached schema for this datasource
        schema_map = schema_registry.get_schema(datasource_id)
        if schema_map:
            schema_summary = schema_registry.get_schema_context(datasource_id)
            table_names = [t.name for t in schema_map.tables]

    if not table_names:
        # Fall back to introspecting the default PG connection directly
        try:
            pwd = settings.pg_password or ""
            if pwd:
                conn_str = (
                    f"postgresql://{settings.pg_username}:{pwd}"
                    f"@{settings.pg_host}:{settings.pg_port}/{settings.pg_database}"
                )
            else:
                conn_str = (
                    f"postgresql://{settings.pg_username}"
                    f"@{settings.pg_host}:{settings.pg_port}/{settings.pg_database}"
                )
            engine = create_engine(conn_str, pool_pre_ping=True)
            insp = inspect(engine)
            table_names = insp.get_table_names(schema="public")

            # Build a quick schema summary
            lines = ["Database schema:"]
            for tbl in table_names:
                cols = insp.get_columns(tbl, schema="public")
                col_str = ", ".join(f"{c['name']} ({c['type']})" for c in cols)
                lines.append(f"  Table {tbl}: {col_str}")
            schema_summary = "\n".join(lines)
        except Exception:
            pass

    if not table_names:
        # No schema available at all - return fallback
        from app.services.question_generator import _fallback_questions
        return SuggestedQuestionsResponse(questions=_fallback_questions())

    questions = generate_questions(table_names, schema_summary)
    return SuggestedQuestionsResponse(questions=questions)


@router.get("/{datasource_id}", response_model=SchemaMap)
async def get_schema(datasource_id: str):
    schema = schema_registry.get_schema(datasource_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found. Connect a datasource first.")
    return schema
