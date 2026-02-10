"""Dashboard generation and management endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.orm import Datasource, User
from app.models.schemas import (
    DashboardEmailRequest,
    DashboardGenerateRequest,
    DashboardIterateRequest,
    DashboardIterationOut,
    DashboardOut,
    DashboardPromptsResponse,
)
from app.services import dashboard as dash_svc
from app.services import email_service
from app.services import question_generator
from app.services import schema_registry

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get("/suggested-prompts", response_model=DashboardPromptsResponse)
async def get_suggested_prompts(
    datasource_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get AI-generated dashboard prompt suggestions based on datasource schema."""
    if not datasource_id:
        # Return generic prompts if no datasource specified
        return DashboardPromptsResponse(
            prompts=question_generator._fallback_dashboard_prompts()
        )

    # Get datasource
    ds = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not ds:
        return DashboardPromptsResponse(
            prompts=question_generator._fallback_dashboard_prompts()
        )

    # Get schema context
    schema_ctx = schema_registry.get_schema_context(datasource_id)
    if not schema_ctx:
        return DashboardPromptsResponse(
            prompts=question_generator._fallback_dashboard_prompts()
        )

    # Extract table names from context (simple parse)
    table_names = []
    for line in schema_ctx.split("\n"):
        if line.strip().startswith("Table:"):
            table_name = line.split("Table:")[1].strip().split()[0]
            table_names.append(table_name)

    prompts = question_generator.generate_dashboard_prompts(table_names, schema_ctx)
    return DashboardPromptsResponse(prompts=prompts)


@router.post("/generate", response_model=DashboardOut, status_code=201)
async def generate_dashboard(
    body: DashboardGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate an AI dashboard from a natural language prompt."""
    return await dash_svc.generate_dashboard(
        prompt=body.prompt,
        db=db,
        datasource_id=body.datasource_id,
    )


@router.get("", response_model=list[DashboardOut])
async def list_dashboards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all saved dashboards."""
    return dash_svc.list_dashboards(db)


@router.get("/{dashboard_id}", response_model=DashboardOut)
async def get_dashboard(
    dashboard_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single dashboard by ID."""
    result = dash_svc.get_dashboard(db, dashboard_id)
    if not result:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return result


@router.delete("/{dashboard_id}", status_code=204)
async def delete_dashboard(
    dashboard_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a dashboard."""
    if not dash_svc.delete_dashboard(db, dashboard_id):
        raise HTTPException(status_code=404, detail="Dashboard not found")


@router.patch("/{dashboard_id}/iterate", response_model=DashboardOut)
async def iterate_dashboard(
    dashboard_id: str,
    body: DashboardIterateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Iterate on a dashboard based on user feedback."""
    result = await dash_svc.iterate_dashboard(
        dashboard_id=dashboard_id,
        feedback=body.feedback,
        db=db,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Dashboard not found or iteration failed")
    return result


@router.get("/{dashboard_id}/iterations", response_model=list[DashboardIterationOut])
async def get_iterations(
    dashboard_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get iteration history for a dashboard."""
    return dash_svc.get_iterations(db, dashboard_id)


@router.post("/email")
async def send_dashboard_email(
    body: DashboardEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a dashboard report via email."""
    result = email_service.send_dashboard_email(
        dashboard_id=body.dashboard_id,
        recipient_emails=body.recipients,
        db=db,
        subject=body.subject,
    )
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result
