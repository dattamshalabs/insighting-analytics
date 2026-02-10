"""CRUD for business term → SQL mappings."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.orm import GlossaryTerm, User
from app.models.schemas import GlossaryTermCreate, GlossaryTermOut, GlossaryTermUpdate
from app.services.sql_validator import SQLValidationError, extract_dependencies, validate_sql_expression

router = APIRouter(prefix="/glossary", tags=["glossary"])


def _term_to_out(term: GlossaryTerm) -> GlossaryTermOut:
    """Convert GlossaryTerm ORM to output schema."""
    dependencies = []
    if term.dependencies_json:
        try:
            dependencies = json.loads(term.dependencies_json)
        except Exception:
            pass
    return GlossaryTermOut(
        id=term.id,
        term=term.term,
        sql_expression=term.sql_expression,
        description=term.description,
        formula_type=term.formula_type or "expression",
        result_type=term.result_type or "numeric",
        dependencies=dependencies,
        created_at=term.created_at,
    )


@router.get("", response_model=list[GlossaryTermOut])
async def list_terms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(GlossaryTerm).order_by(GlossaryTerm.term).all()
    return [_term_to_out(r) for r in rows]


@router.post("", response_model=GlossaryTermOut, status_code=201)
async def create_term(
    body: GlossaryTermCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate SQL expression
    try:
        validate_sql_expression(body.sql_expression)
    except SQLValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = db.query(GlossaryTerm).filter(GlossaryTerm.term == body.term).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Term '{body.term}' already exists")

    # Extract dependencies
    existing_terms = [t.term for t in db.query(GlossaryTerm).all()]
    dependencies = extract_dependencies(body.sql_expression, existing_terms)

    term = GlossaryTerm(
        term=body.term,
        sql_expression=body.sql_expression,
        description=body.description,
        formula_type=body.formula_type,
        result_type=body.result_type,
        dependencies_json=json.dumps(dependencies) if dependencies else None,
    )
    db.add(term)
    db.commit()
    db.refresh(term)
    return _term_to_out(term)


@router.put("/{term_id}", response_model=GlossaryTermOut)
async def update_term(
    term_id: str,
    body: GlossaryTermUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    term = db.query(GlossaryTerm).filter(GlossaryTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")

    # Validate SQL if being updated
    if body.sql_expression:
        try:
            validate_sql_expression(body.sql_expression)
        except SQLValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(term, field, value)

    # Re-extract dependencies if SQL changed
    if body.sql_expression:
        existing_terms = [t.term for t in db.query(GlossaryTerm).filter(GlossaryTerm.id != term_id).all()]
        dependencies = extract_dependencies(body.sql_expression, existing_terms)
        term.dependencies_json = json.dumps(dependencies) if dependencies else None

    db.commit()
    db.refresh(term)
    return _term_to_out(term)


@router.delete("/{term_id}", status_code=204)
async def delete_term(
    term_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    term = db.query(GlossaryTerm).filter(GlossaryTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    db.delete(term)
    db.commit()
