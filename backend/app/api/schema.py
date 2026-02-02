"""GET schema introspection + inferred relations."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import SchemaMap
from app.services import schema_registry

router = APIRouter(prefix="/schema", tags=["schema"])


@router.get("/{datasource_id}", response_model=SchemaMap)
async def get_schema(datasource_id: str):
    schema = schema_registry.get_schema(datasource_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found. Connect a datasource first.")
    return schema
