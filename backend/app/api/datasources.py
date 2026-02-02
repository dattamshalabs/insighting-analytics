"""CRUD for PostgreSQL datasource connections."""

from __future__ import annotations

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.orm import Datasource
from app.models.schemas import DatasourceCreate, DatasourceOut
from app.services import schema_registry
from app.skills.profiling import profile_datasource

router = APIRouter(prefix="/datasources", tags=["datasources"])


def _encrypt(plaintext: str) -> str:
    if not settings.encryption_key:
        return plaintext  # fallback: store plain (dev only)
    f = Fernet(settings.encryption_key.encode())
    return f.encrypt(plaintext.encode()).decode()


def _decrypt(ciphertext: str) -> str:
    if not settings.encryption_key:
        return ciphertext
    f = Fernet(settings.encryption_key.encode())
    return f.decrypt(ciphertext.encode()).decode()


def _connection_string(ds: Datasource) -> str:
    pwd = _decrypt(ds.encrypted_password)
    ssl = f"?sslmode={ds.ssl_mode}" if ds.ssl_mode != "disable" else ""
    return f"postgresql://{ds.username}:{pwd}@{ds.host}:{ds.port}/{ds.database}{ssl}"


@router.get("", response_model=list[DatasourceOut])
async def list_datasources(db: Session = Depends(get_db)):
    rows = db.query(Datasource).order_by(Datasource.created_at.desc()).all()
    return [
        DatasourceOut(
            id=r.id, name=r.name, host=r.host, port=r.port,
            database=r.database, username=r.username, ssl_mode=r.ssl_mode,
            is_default=r.is_default, created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("", response_model=DatasourceOut, status_code=201)
async def create_datasource(body: DatasourceCreate, db: Session = Depends(get_db)):
    ds = Datasource(
        name=body.name,
        host=body.host,
        port=body.port,
        database=body.database,
        username=body.username,
        encrypted_password=_encrypt(body.password),
        ssl_mode=body.ssl_mode,
        is_default=body.is_default,
    )
    # If is_default, unset others
    if body.is_default:
        db.query(Datasource).update({Datasource.is_default: False})

    db.add(ds)
    db.commit()
    db.refresh(ds)

    # Auto-introspect schema
    conn_str = _connection_string(ds)
    try:
        schema_registry.introspect(ds.id, conn_str)
        profile_datasource(conn_str)  # auto-profile
    except Exception as e:
        pass  # non-fatal; user can retry

    return DatasourceOut(
        id=ds.id, name=ds.name, host=ds.host, port=ds.port,
        database=ds.database, username=ds.username, ssl_mode=ds.ssl_mode,
        is_default=ds.is_default, created_at=ds.created_at,
    )


@router.delete("/{datasource_id}", status_code=204)
async def delete_datasource(datasource_id: str, db: Session = Depends(get_db)):
    ds = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Datasource not found")
    schema_registry.clear(datasource_id)
    db.delete(ds)
    db.commit()


@router.post("/{datasource_id}/refresh-schema")
async def refresh_schema(datasource_id: str, db: Session = Depends(get_db)):
    ds = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Datasource not found")
    conn_str = _connection_string(ds)
    schema_map = schema_registry.introspect(ds.id, conn_str)
    return {"tables": len(schema_map.tables), "relations": len(schema_map.relations)}
