"""SQLAlchemy ORM models for the local metadata DB."""

from __future__ import annotations

import datetime
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime.datetime:
    return datetime.datetime.utcnow()


# ---------------------------------------------------------------------------
# Datasources
# ---------------------------------------------------------------------------

class Datasource(Base):
    __tablename__ = "datasources"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    host = Column(String, nullable=False)
    port = Column(Integer, default=5432)
    database = Column(String, nullable=False)
    username = Column(String, nullable=False)
    encrypted_password = Column(String, nullable=False)
    ssl_mode = Column(String, default="disable")
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


# ---------------------------------------------------------------------------
# Conversations & messages
# ---------------------------------------------------------------------------

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, default="New conversation")
    datasource_id = Column(String, ForeignKey("datasources.id"), nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=True)
    generated_code = Column(Text, nullable=True)
    chart_path = Column(String, nullable=True)
    recommendations_json = Column(Text, nullable=True)
    data_quality_json = Column(Text, nullable=True)
    stats_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)

    conversation = relationship("Conversation", back_populates="messages")


# ---------------------------------------------------------------------------
# Annotations
# ---------------------------------------------------------------------------

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(String, primary_key=True, default=_uuid)
    message_id = Column(String, ForeignKey("messages.id"), nullable=False)
    author = Column(String, default="user")
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now)


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    datasource_id = Column(String, ForeignKey("datasources.id"), nullable=True)
    query = Column(Text, nullable=False)
    cron_expression = Column(String, nullable=False)
    threshold_condition = Column(Text, nullable=False)  # e.g. "result > 100"
    webhook_url = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


# ---------------------------------------------------------------------------
# Business glossary
# ---------------------------------------------------------------------------

class GlossaryTerm(Base):
    __tablename__ = "glossary_terms"

    id = Column(String, primary_key=True, default=_uuid)
    term = Column(String, nullable=False, unique=True)
    sql_expression = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


# ---------------------------------------------------------------------------
# Observability logs
# ---------------------------------------------------------------------------

class LLMCallLog(Base):
    __tablename__ = "llm_call_logs"

    id = Column(String, primary_key=True, default=_uuid)
    model = Column(String, nullable=False)
    prompt_length = Column(Integer)
    response_length = Column(Integer)
    tokens_used = Column(Integer, nullable=True)
    latency_ms = Column(Float)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)


class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(String, primary_key=True, default=_uuid)
    datasource_id = Column(String, nullable=True)
    sql = Column(Text, nullable=False)
    rows_returned = Column(Integer, nullable=True)
    duration_ms = Column(Float, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)
