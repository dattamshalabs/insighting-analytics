"""POST /chat endpoint + conversation history."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationDetailOut,
    ConversationOut,
    MessageOut,
)
from app.services import conversation as conv_svc
from app.services.intelligence import process_query

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    return await process_query(
        query=req.query,
        db=db,
        session_id=req.session_id,
        datasource_id=req.datasource_id,
    )


@router.get("/chat/sessions", response_model=list[ConversationOut])
async def list_sessions(db: Session = Depends(get_db)):
    convs = conv_svc.list_conversations(db)
    return [
        ConversationOut(
            id=c.id,
            title=c.title,
            datasource_id=c.datasource_id,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in convs
    ]


@router.get("/chat/history/{session_id}", response_model=ConversationDetailOut)
async def get_history(session_id: str, db: Session = Depends(get_db)):
    conv = conv_svc.get_conversation_with_messages(db, session_id)
    if not conv:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Conversation not found")

    import json
    messages = []
    for m in conv.messages:
        recs = []
        if m.recommendations_json:
            try:
                recs = json.loads(m.recommendations_json)
            except Exception:
                pass
        dq = None
        if m.data_quality_json:
            try:
                dq = json.loads(m.data_quality_json)
            except Exception:
                pass
        stats = None
        if m.stats_json:
            try:
                stats = json.loads(m.stats_json)
            except Exception:
                pass

        messages.append(MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            generated_sql=m.generated_sql,
            chart_url=m.chart_path,
            recommendations=recs,
            data_quality=dq,
            stats=stats,
            created_at=m.created_at,
        ))

    return ConversationDetailOut(
        id=conv.id,
        title=conv.title,
        datasource_id=conv.datasource_id,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=messages,
    )
