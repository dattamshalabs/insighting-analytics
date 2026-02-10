"""CRUD for scheduled insight alerts."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import json

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.orm import Alert, AlertConnectorConfig, User
from app.models.schemas import AlertConnectorCreate, AlertConnectorOut, AlertCreate, AlertOut, AlertUpdate
from app.services.alert_connectors import validate_connector_config
from app.services.scheduler import add_alert_job, get_scheduler, remove_alert_job

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
async def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
async def create_alert(
    body: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
async def update_alert(
    alert_id: str,
    body: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
async def delete_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    remove_alert_job(alert.id)
    db.delete(alert)
    db.commit()


# ---------------------------------------------------------------------------
# Alert Connectors
# ---------------------------------------------------------------------------

def _encrypt_config(config: dict) -> str:
    """Encrypt connector config for storage."""
    config_str = json.dumps(config)
    if not settings.encryption_key:
        return config_str
    from cryptography.fernet import Fernet
    f = Fernet(settings.encryption_key.encode())
    return f.encrypt(config_str.encode()).decode()


@router.get("/{alert_id}/connectors", response_model=list[AlertConnectorOut])
async def list_connectors(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List connectors for an alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    connectors = (
        db.query(AlertConnectorConfig)
        .filter(AlertConnectorConfig.alert_id == alert_id)
        .order_by(AlertConnectorConfig.created_at.desc())
        .all()
    )
    return [
        AlertConnectorOut(
            id=c.id,
            alert_id=c.alert_id,
            connector_type=c.connector_type,
            enabled=c.enabled,
            created_at=c.created_at,
        )
        for c in connectors
    ]


@router.post("/{alert_id}/connectors", response_model=AlertConnectorOut, status_code=201)
async def add_connector(
    alert_id: str,
    body: AlertConnectorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a connector to an alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Validate connector config
    if not validate_connector_config(body.connector_type, body.config):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid configuration for {body.connector_type} connector",
        )

    connector = AlertConnectorConfig(
        alert_id=alert_id,
        connector_type=body.connector_type,
        config_json=_encrypt_config(body.config),
        enabled=body.enabled,
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)

    return AlertConnectorOut(
        id=connector.id,
        alert_id=connector.alert_id,
        connector_type=connector.connector_type,
        enabled=connector.enabled,
        created_at=connector.created_at,
    )


@router.delete("/{alert_id}/connectors/{connector_id}", status_code=204)
async def remove_connector(
    alert_id: str,
    connector_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a connector from an alert."""
    connector = (
        db.query(AlertConnectorConfig)
        .filter(
            AlertConnectorConfig.id == connector_id,
            AlertConnectorConfig.alert_id == alert_id,
        )
        .first()
    )
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")

    db.delete(connector)
    db.commit()
