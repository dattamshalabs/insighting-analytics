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
# Users & Authentication
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")  # "user" | "admin"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    last_login_at = Column(DateTime, nullable=True)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)

    user = relationship("User", backref="refresh_tokens")


# ---------------------------------------------------------------------------
# Datasources
# ---------------------------------------------------------------------------

class Datasource(Base):
    __tablename__ = "datasources"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    db_type = Column(String, default="postgresql")  # postgresql | mysql | mssql | databricks | csv | excel
    host = Column(String, nullable=True)
    port = Column(Integer, nullable=True)
    database = Column(String, nullable=True)
    username = Column(String, nullable=True)
    encrypted_password = Column(String, nullable=True)
    ssl_mode = Column(String, default="disable")
    # Databricks-specific
    http_path = Column(String, nullable=True)
    catalog = Column(String, nullable=True)
    access_token = Column(String, nullable=True)
    # File-based (CSV/Excel)
    file_path = Column(String, nullable=True)
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


class MessageFeedback(Base):
    __tablename__ = "message_feedback"

    id = Column(String, primary_key=True, default=_uuid)
    message_id = Column(String, ForeignKey("messages.id"), nullable=False)
    rating = Column(String, nullable=False)  # "up" | "down"
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

    connectors = relationship("AlertConnectorConfig", back_populates="alert", cascade="all, delete-orphan")


class AlertConnectorConfig(Base):
    __tablename__ = "alert_connectors"

    id = Column(String, primary_key=True, default=_uuid)
    alert_id = Column(String, ForeignKey("alerts.id"), nullable=False, index=True)
    connector_type = Column(String, nullable=False)  # "email" | "slack" | "sftp"
    config_json = Column(Text, nullable=False)  # Encrypted JSON config
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)

    alert = relationship("Alert", back_populates="connectors")


# ---------------------------------------------------------------------------
# Business glossary
# ---------------------------------------------------------------------------

class GlossaryTerm(Base):
    __tablename__ = "glossary_terms"

    id = Column(String, primary_key=True, default=_uuid)
    term = Column(String, nullable=False, unique=True)
    sql_expression = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    formula_type = Column(String, default="expression")  # expression | calculation | metric
    result_type = Column(String, default="numeric")  # numeric | string | boolean
    dependencies_json = Column(Text, nullable=True)  # JSON array of dependent term names
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


# ---------------------------------------------------------------------------
# Dashboards
# ---------------------------------------------------------------------------

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, nullable=False)
    datasource_id = Column(String, ForeignKey("datasources.id"), nullable=True)
    prompt = Column(Text, nullable=True)
    widgets_json = Column(Text, nullable=False, default="[]")  # JSON array of widget configs
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    iterations = relationship("DashboardIteration", back_populates="dashboard", order_by="DashboardIteration.iteration_number")


class DashboardIteration(Base):
    __tablename__ = "dashboard_iterations"

    id = Column(String, primary_key=True, default=_uuid)
    dashboard_id = Column(String, ForeignKey("dashboards.id"), nullable=False, index=True)
    iteration_number = Column(Integer, nullable=False)
    feedback = Column(Text, nullable=False)
    previous_widgets_json = Column(Text, nullable=False)
    new_widgets_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now)

    dashboard = relationship("Dashboard", back_populates="iterations")


# ---------------------------------------------------------------------------
# SMTP configuration
# ---------------------------------------------------------------------------

class SmtpConfig(Base):
    __tablename__ = "smtp_config"

    id = Column(String, primary_key=True, default=_uuid)
    host = Column(String, nullable=False)
    port = Column(Integer, default=587)
    username = Column(String, nullable=True)
    encrypted_password = Column(String, nullable=True)
    from_email = Column(String, nullable=False)
    use_tls = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
