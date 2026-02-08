"""Dashboard generation and management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas import DashboardGenerateRequest, DashboardOut
from app.services import dashboard as dash_svc

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.post("/generate", response_model=DashboardOut, status_code=201)
async def generate_dashboard(body: DashboardGenerateRequest, db: Session = Depends(get_db)):
    """Generate an AI dashboard from a natural language prompt."""
    return await dash_svc.generate_dashboard(
        prompt=body.prompt,
        db=db,
        datasource_id=body.datasource_id,
    )


@router.get("", response_model=list[DashboardOut])
async def list_dashboards(db: Session = Depends(get_db)):
    """List all saved dashboards."""
    return dash_svc.list_dashboards(db)


@router.get("/{dashboard_id}", response_model=DashboardOut)
async def get_dashboard(dashboard_id: str, db: Session = Depends(get_db)):
    """Get a single dashboard by ID."""
    result = dash_svc.get_dashboard(db, dashboard_id)
    if not result:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return result


@router.delete("/{dashboard_id}", status_code=204)
async def delete_dashboard(dashboard_id: str, db: Session = Depends(get_db)):
    """Delete a dashboard."""
    if not dash_svc.delete_dashboard(db, dashboard_id):
        raise HTTPException(status_code=404, detail="Dashboard not found")
