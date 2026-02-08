"""POST /chat endpoint + conversation history + on-demand recommendations."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.orm import MessageFeedback
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationDetailOut,
    ConversationOut,
    ConversationRenameRequest,
    FeedbackRequest,
    FeedbackResponse,
    MessageOut,
    Recommendation,
    RecommendationRequest,
    RecommendationResponse,
)
from app.services import conversation as conv_svc
from app.services import recommendation as rec_svc
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


@router.post("/chat/recommendations", response_model=RecommendationResponse)
async def generate_recommendations(req: RecommendationRequest, db: Session = Depends(get_db)):
    """On-demand recommendation generation for a specific message."""
    msg = conv_svc.get_message(db, req.message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Check if recommendations already exist for this message
    if msg.recommendations_json:
        try:
            existing = json.loads(msg.recommendations_json)
            if existing:
                return RecommendationResponse(
                    recommendations=[Recommendation(**r) for r in existing]
                )
        except Exception:
            pass

    # Generate fresh recommendations
    recs = await rec_svc.generate_recommendations(
        analysis_text=msg.content,
        query="",  # We don't have the original query stored separately on the message
        generated_sql=msg.generated_sql,
    )

    # Persist to the message
    conv_svc.update_message_recommendations(
        db, req.message_id, [r.model_dump() for r in recs]
    )

    return RecommendationResponse(recommendations=recs)


@router.post("/chat/feedback", response_model=FeedbackResponse)
async def submit_feedback(req: FeedbackRequest, db: Session = Depends(get_db)):
    """Submit thumbs up/down feedback on a message."""
    msg = conv_svc.get_message(db, req.message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    feedback = MessageFeedback(
        message_id=req.message_id,
        rating=req.rating,
    )
    db.add(feedback)
    db.commit()
    return FeedbackResponse(status="ok")


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


@router.patch("/chat/sessions/{session_id}", response_model=ConversationOut)
async def rename_session(
    session_id: str, req: ConversationRenameRequest, db: Session = Depends(get_db)
):
    conv = conv_svc.rename_conversation(db, session_id, req.title)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        datasource_id=conv.datasource_id,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.delete("/chat/sessions/{session_id}")
async def delete_session(session_id: str, db: Session = Depends(get_db)):
    deleted = conv_svc.delete_conversation(db, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "ok"}


@router.get("/chat/history/{session_id}", response_model=ConversationDetailOut)
async def get_history(session_id: str, db: Session = Depends(get_db)):
    conv = conv_svc.get_conversation_with_messages(db, session_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

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
