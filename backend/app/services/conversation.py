"""Persist & retrieve conversation history, context window for LLM."""

from __future__ import annotations

import json
import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.orm import Conversation, Message

logger = logging.getLogger(__name__)

DEFAULT_CONTEXT_WINDOW = 10  # last N messages sent to LLM


def get_or_create_conversation(
    db: Session,
    session_id: Optional[str] = None,
    datasource_id: Optional[str] = None,
) -> Conversation:
    if session_id:
        conv = db.query(Conversation).filter(Conversation.id == session_id).first()
        if conv:
            return conv
    conv = Conversation(datasource_id=datasource_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def add_message(
    db: Session,
    conversation_id: str,
    role: str,
    content: str,
    *,
    generated_sql: Optional[str] = None,
    generated_code: Optional[str] = None,
    chart_path: Optional[str] = None,
    recommendations: Optional[list] = None,
    data_quality: Optional[dict] = None,
    stats: Optional[dict] = None,
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        generated_sql=generated_sql,
        generated_code=generated_code,
        chart_path=chart_path,
        recommendations_json=json.dumps(recommendations) if recommendations else None,
        data_quality_json=json.dumps(data_quality) if data_quality else None,
        stats_json=json.dumps(stats) if stats else None,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_context_messages(
    db: Session,
    conversation_id: str,
    limit: int = DEFAULT_CONTEXT_WINDOW,
) -> List[dict]:
    """Return the last N messages formatted for LLM context."""
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()
    return [
        {"role": m.role, "content": m.content}
        for m in messages
    ]


def list_conversations(db: Session, limit: int = 50) -> List[Conversation]:
    return (
        db.query(Conversation)
        .order_by(Conversation.updated_at.desc())
        .limit(limit)
        .all()
    )


def get_conversation_with_messages(db: Session, conversation_id: str) -> Optional[Conversation]:
    return db.query(Conversation).filter(Conversation.id == conversation_id).first()


def rename_conversation(db: Session, conversation_id: str, title: str) -> Optional[Conversation]:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv:
        conv.title = title
        db.commit()
        db.refresh(conv)
    return conv


def delete_conversation(db: Session, conversation_id: str) -> bool:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        return False
    db.query(Message).filter(Message.conversation_id == conversation_id).delete()
    db.delete(conv)
    db.commit()
    return True


def get_message(db: Session, message_id: str) -> Optional[Message]:
    return db.query(Message).filter(Message.id == message_id).first()


def update_message_recommendations(db: Session, message_id: str, recommendations: list) -> None:
    import json
    msg = db.query(Message).filter(Message.id == message_id).first()
    if msg:
        msg.recommendations_json = json.dumps(recommendations)
        db.commit()
