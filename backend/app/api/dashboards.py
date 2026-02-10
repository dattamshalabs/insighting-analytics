"""Dashboard generation and management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.orm import User
from app.models.schemas import (
    DashboardEmailRequest,
    DashboardGenerateRequest,
    DashboardIterateRequest,
    DashboardIterationOut,
    DashboardOut,
)
from app.services import dashboard as dash_svc
from app.services import email_service

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


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
