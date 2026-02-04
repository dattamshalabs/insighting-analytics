"""GET schema introspection + inferred relations."""

from typing import List

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import SchemaMap
from app.services import schema_registry

router = APIRouter(prefix="/schema", tags=["schema"])


@router.get("/{datasource_id}", response_model=SchemaMap)
async def get_schema(datasource_id: str):
    schema = schema_registry.get_schema(datasource_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found. Connect a datasource first.")
    return schema


@router.get("/{datasource_id}/suggestions", response_model=List[str])
async def get_suggested_questions(
    datasource_id: str,
    limit: int = Query(default=8, ge=1, le=20)
):
    """Get contextual suggested questions based on the available tables."""
    schema = schema_registry.get_schema(datasource_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found. Connect a datasource first.")
    return schema_registry.get_suggested_questions(datasource_id, max_questions=limit)
