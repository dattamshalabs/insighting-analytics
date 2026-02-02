"""CRUD for business term → SQL mappings."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.orm import GlossaryTerm
from app.models.schemas import GlossaryTermCreate, GlossaryTermOut, GlossaryTermUpdate

router = APIRouter(prefix="/glossary", tags=["glossary"])


@router.get("", response_model=list[GlossaryTermOut])
async def list_terms(db: Session = Depends(get_db)):
    rows = db.query(GlossaryTerm).order_by(GlossaryTerm.term).all()
    return [
        GlossaryTermOut(
            id=r.id, term=r.term, sql_expression=r.sql_expression,
            description=r.description, created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("", response_model=GlossaryTermOut, status_code=201)
async def create_term(body: GlossaryTermCreate, db: Session = Depends(get_db)):
    existing = db.query(GlossaryTerm).filter(GlossaryTerm.term == body.term).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Term '{body.term}' already exists")
    term = GlossaryTerm(
        term=body.term,
        sql_expression=body.sql_expression,
        description=body.description,
    )
    db.add(term)
    db.commit()
    db.refresh(term)
    return GlossaryTermOut(
        id=term.id, term=term.term, sql_expression=term.sql_expression,
        description=term.description, created_at=term.created_at,
    )


@router.put("/{term_id}", response_model=GlossaryTermOut)
async def update_term(term_id: str, body: GlossaryTermUpdate, db: Session = Depends(get_db)):
    term = db.query(GlossaryTerm).filter(GlossaryTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(term, field, value)
    db.commit()
    db.refresh(term)
    return GlossaryTermOut(
        id=term.id, term=term.term, sql_expression=term.sql_expression,
        description=term.description, created_at=term.created_at,
    )


@router.delete("/{term_id}", status_code=204)
async def delete_term(term_id: str, db: Session = Depends(get_db)):
    term = db.query(GlossaryTerm).filter(GlossaryTerm.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    db.delete(term)
    db.commit()
