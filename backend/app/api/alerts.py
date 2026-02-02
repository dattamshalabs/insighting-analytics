"""CRUD for scheduled insight alerts."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.orm import Alert
from app.models.schemas import AlertCreate, AlertOut, AlertUpdate
from app.services.scheduler import add_alert_job, get_scheduler, remove_alert_job

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
async def list_alerts(db: Session = Depends(get_db)):
    rows = db.query(Alert).order_by(Alert.created_at.desc()).all()
    return [
        AlertOut(
            id=r.id, name=r.name, datasource_id=r.datasource_id,
            query=r.query, cron_expression=r.cron_expression,
            threshold_condition=r.threshold_condition,
            webhook_url=r.webhook_url, enabled=r.enabled,
            last_triggered_at=r.last_triggered_at, created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("", response_model=AlertOut, status_code=201)
async def create_alert(body: AlertCreate, db: Session = Depends(get_db)):
    alert = Alert(
        name=body.name,
        datasource_id=body.datasource_id,
        query=body.query,
        cron_expression=body.cron_expression,
        threshold_condition=body.threshold_condition,
        webhook_url=body.webhook_url,
        enabled=body.enabled,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    if alert.enabled:
        add_alert_job(get_scheduler(), alert)

    return AlertOut(
        id=alert.id, name=alert.name, datasource_id=alert.datasource_id,
        query=alert.query, cron_expression=alert.cron_expression,
        threshold_condition=alert.threshold_condition,
        webhook_url=alert.webhook_url, enabled=alert.enabled,
        last_triggered_at=alert.last_triggered_at, created_at=alert.created_at,
    )


@router.put("/{alert_id}", response_model=AlertOut)
async def update_alert(alert_id: str, body: AlertUpdate, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(alert, field, value)
    db.commit()
    db.refresh(alert)

    if alert.enabled:
        add_alert_job(get_scheduler(), alert)
    else:
        remove_alert_job(alert.id)

    return AlertOut(
        id=alert.id, name=alert.name, datasource_id=alert.datasource_id,
        query=alert.query, cron_expression=alert.cron_expression,
        threshold_condition=alert.threshold_condition,
        webhook_url=alert.webhook_url, enabled=alert.enabled,
        last_triggered_at=alert.last_triggered_at, created_at=alert.created_at,
    )


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    remove_alert_job(alert.id)
    db.delete(alert)
    db.commit()
