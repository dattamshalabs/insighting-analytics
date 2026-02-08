"""CRUD for datasource connections — PostgreSQL, MySQL, MSSQL, Databricks, CSV, Excel."""

from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.orm import Datasource
from app.models.schemas import DatasourceCreate, DatasourceOut
from app.services import schema_registry
from app.services.db_engine import build_connection_string

router = APIRouter(prefix="/datasources", tags=["datasources"])

UPLOAD_DIR = Path("data/uploads")


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
    """Build a connection string from a Datasource ORM object."""
    pwd = _decrypt(ds.encrypted_password) if ds.encrypted_password else ""
    return build_connection_string(
        db_type=ds.db_type or "postgresql",
        host=ds.host,
        port=ds.port,
        database=ds.database,
        username=ds.username,
        password=pwd,
        ssl_mode=ds.ssl_mode or "disable",
        http_path=ds.http_path,
        catalog=ds.catalog,
        access_token=_decrypt(ds.access_token) if ds.access_token else None,
    )


def _ds_to_out(ds: Datasource) -> DatasourceOut:
    return DatasourceOut(
        id=ds.id,
        name=ds.name,
        db_type=ds.db_type or "postgresql",
        host=ds.host,
        port=ds.port,
        database=ds.database,
        username=ds.username,
        ssl_mode=ds.ssl_mode or "disable",
        is_default=ds.is_default or False,
        file_path=ds.file_path,
        created_at=ds.created_at,
    )


@router.get("", response_model=list[DatasourceOut])
async def list_datasources(db: Session = Depends(get_db)):
    rows = db.query(Datasource).order_by(Datasource.created_at.desc()).all()
    return [_ds_to_out(r) for r in rows]


@router.post("", response_model=DatasourceOut, status_code=201)
async def create_datasource(body: DatasourceCreate, db: Session = Depends(get_db)):
    ds = Datasource(
        name=body.name,
        db_type=body.db_type,
        host=body.host,
        port=body.port,
        database=body.database,
        username=body.username,
        encrypted_password=_encrypt(body.password) if body.password else None,
        ssl_mode=body.ssl_mode,
        http_path=body.http_path,
        catalog=body.catalog,
        access_token=_encrypt(body.access_token) if body.access_token else None,
        is_default=body.is_default,
    )

    if body.is_default:
        db.query(Datasource).update({Datasource.is_default: False})

    db.add(ds)
    db.commit()
    db.refresh(ds)

    # Auto-introspect schema for database types (not file-based)
    if body.db_type not in ("csv", "excel"):
        try:
            conn_str = _connection_string(ds)
            schema_registry.introspect(ds.id, conn_str, db_type=body.db_type)
        except Exception:
            pass  # non-fatal; user can retry

    return _ds_to_out(ds)


@router.post("/upload", response_model=DatasourceOut, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    name: str = Form(""),
    db: Session = Depends(get_db),
):
    """Upload a CSV or Excel file as a datasource."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".csv", ".xlsx", ".xls"):
        raise HTTPException(status_code=400, detail="Only .csv, .xlsx, and .xls files are supported")

    db_type = "csv" if ext == ".csv" else "excel"
    ds_name = name or Path(file.filename).stem

    # Save file
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())[:8]
    saved_filename = f"{file_id}_{file.filename}"
    saved_path = UPLOAD_DIR / saved_filename

    with open(saved_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    ds = Datasource(
        name=ds_name,
        db_type=db_type,
        file_path=str(saved_path),
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    return _ds_to_out(ds)


@router.delete("/{datasource_id}", status_code=204)
async def delete_datasource(datasource_id: str, db: Session = Depends(get_db)):
    ds = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Datasource not found")

    # Clean up uploaded file if it's file-based
    if ds.file_path and os.path.exists(ds.file_path):
        os.remove(ds.file_path)

    schema_registry.clear(datasource_id)
    db.delete(ds)
    db.commit()


@router.post("/{datasource_id}/refresh-schema")
async def refresh_schema(datasource_id: str, db: Session = Depends(get_db)):
    ds = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Datasource not found")

    if ds.db_type in ("csv", "excel"):
        return {"tables": 1, "relations": 0, "note": "File-based datasources have a single table"}

    conn_str = _connection_string(ds)
    schema_map = schema_registry.introspect(ds.id, conn_str, db_type=ds.db_type or "postgresql")
    return {"tables": len(schema_map.tables), "relations": len(schema_map.relations)}
