"""Pydantic request / response models."""

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    datasource_id: Optional[str] = None


class DataQualityIssue(BaseModel):
    column: Optional[str] = None
    check: str  # completeness | uniqueness | freshness | outlier | type | volume
    severity: str = "warning"  # warning | error | info
    message: str
    value: Optional[Any] = None


class DataQualityReport(BaseModel):
    issues: List[DataQualityIssue] = []
    overall_score: float = 1.0  # 0..1


class Recommendation(BaseModel):
    action: str
    rationale: str
    expected_impact: str
    confidence: float = Field(ge=0, le=1)
    priority: str = "medium"  # high | medium | low


class StatResult(BaseModel):
    test_name: str
    statistic: Optional[float] = None
    p_value: Optional[float] = None
    interpretation: str = ""
    details: Dict[str, Any] = {}


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    generated_sql: Optional[str] = None
    generated_code: Optional[str] = None
    chart_url: Optional[str] = None
    stats: Optional[StatResult] = None
    data_quality: Optional[DataQualityReport] = None
    recommendations: List[Recommendation] = []


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    generated_sql: Optional[str] = None
    chart_url: Optional[str] = None
    recommendations: List[Recommendation] = []
    data_quality: Optional[DataQualityReport] = None
    stats: Optional[StatResult] = None
    created_at: datetime.datetime


class ConversationOut(BaseModel):
    id: str
    title: str
    datasource_id: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class ConversationDetailOut(ConversationOut):
    messages: List[MessageOut] = []


# ---------------------------------------------------------------------------
# Datasources
# ---------------------------------------------------------------------------

class DatasourceCreate(BaseModel):
    name: str
    db_type: str = "postgresql"  # postgresql | mysql | mssql | databricks | csv | excel
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssl_mode: str = "disable"
    is_default: bool = False
    # Databricks-specific
    http_path: Optional[str] = None
    catalog: Optional[str] = None
    access_token: Optional[str] = None


class DatasourceOut(BaseModel):
    id: str
    name: str
    db_type: str = "postgresql"
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    ssl_mode: str = "disable"
    is_default: bool = False
    file_path: Optional[str] = None
    created_at: datetime.datetime


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

class ColumnInfo(BaseModel):
    name: str
    data_type: str
    nullable: bool = True
    is_primary_key: bool = False
    is_foreign_key: bool = False
    references: Optional[str] = None  # "table.column"


class TableInfo(BaseModel):
    name: str
    schema_name: str = "public"
    row_count: Optional[int] = None
    columns: List[ColumnInfo] = []


class InferredRelation(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    confidence: float = Field(ge=0, le=1)
    relation_type: str = "inferred"  # explicit | inferred


class SchemaMap(BaseModel):
    datasource_id: str
    tables: List[TableInfo] = []
    relations: List[InferredRelation] = []


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class AlertCreate(BaseModel):
    name: str
    datasource_id: Optional[str] = None
    query: str
    cron_expression: str = "0 9 * * *"  # daily at 9am
    threshold_condition: str
    webhook_url: Optional[str] = None
    enabled: bool = True


class AlertUpdate(BaseModel):
    name: Optional[str] = None
    query: Optional[str] = None
    cron_expression: Optional[str] = None
    threshold_condition: Optional[str] = None
    webhook_url: Optional[str] = None
    enabled: Optional[bool] = None


class AlertOut(BaseModel):
    id: str
    name: str
    datasource_id: Optional[str] = None
    query: str
    cron_expression: str
    threshold_condition: str
    webhook_url: Optional[str] = None
    enabled: bool
    last_triggered_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime


# ---------------------------------------------------------------------------
# Glossary
# ---------------------------------------------------------------------------

class GlossaryTermCreate(BaseModel):
    term: str
    sql_expression: str
    description: Optional[str] = None


class GlossaryTermUpdate(BaseModel):
    term: Optional[str] = None
    sql_expression: Optional[str] = None
    description: Optional[str] = None


class GlossaryTermOut(BaseModel):
    id: str
    term: str
    sql_expression: str
    description: Optional[str] = None
    created_at: datetime.datetime


# ---------------------------------------------------------------------------
# Observability / admin
# ---------------------------------------------------------------------------

class LLMLogOut(BaseModel):
    id: str
    model: str
    prompt_length: Optional[int] = None
    response_length: Optional[int] = None
    tokens_used: Optional[int] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    created_at: datetime.datetime


class QueryLogOut(BaseModel):
    id: str
    datasource_id: Optional[str] = None
    sql: str
    rows_returned: Optional[int] = None
    duration_ms: Optional[float] = None
    error: Optional[str] = None
    created_at: datetime.datetime


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

class ExportRequest(BaseModel):
    format: str = "csv"  # csv | pdf


# ---------------------------------------------------------------------------
# On-demand recommendations
# ---------------------------------------------------------------------------

class RecommendationRequest(BaseModel):
    message_id: str
    session_id: str


class RecommendationResponse(BaseModel):
    recommendations: List[Recommendation] = []


# ---------------------------------------------------------------------------
# Message feedback
# ---------------------------------------------------------------------------

class FeedbackRequest(BaseModel):
    message_id: str
    rating: str  # "up" | "down"


class FeedbackResponse(BaseModel):
    status: str = "ok"


# ---------------------------------------------------------------------------
# Conversation management
# ---------------------------------------------------------------------------

class ConversationRenameRequest(BaseModel):
    title: str


# ---------------------------------------------------------------------------
# Data profiling
# ---------------------------------------------------------------------------

class ColumnProfile(BaseModel):
    name: str
    data_type: str
    null_pct: float = 0.0
    cardinality: int = 0
    min_value: Optional[Any] = None
    max_value: Optional[Any] = None
    mean_value: Optional[float] = None
    sample_values: List[Any] = []


class TableProfile(BaseModel):
    table_name: str
    row_count: int = 0
    column_count: int = 0
    columns: List[ColumnProfile] = []


# ---------------------------------------------------------------------------
# Generic
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.2.0"


# ---------------------------------------------------------------------------
# Dashboards
# ---------------------------------------------------------------------------

class DashboardWidget(BaseModel):
    id: str
    type: str  # kpi | bar | line | area | pie | table | insight
    title: str
    data: Any = None
    config: Dict[str, Any] = {}


class DashboardGenerateRequest(BaseModel):
    prompt: str
    datasource_id: Optional[str] = None


class DashboardOut(BaseModel):
    id: str
    title: str
    datasource_id: Optional[str] = None
    prompt: Optional[str] = None
    widgets: List[DashboardWidget] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ---------------------------------------------------------------------------
# Suggested questions (dynamic)
# ---------------------------------------------------------------------------

class SuggestedQuestion(BaseModel):
    text: str
    category: str  # trend | comparison | distribution | ranking | anomaly | correlation
    icon_hint: str  # chart | table | search | bolt


class SuggestedQuestionsResponse(BaseModel):
    questions: List[SuggestedQuestion] = []


# ---------------------------------------------------------------------------
# SMTP configuration
# ---------------------------------------------------------------------------

class SmtpConfigCreate(BaseModel):
    host: str
    port: int = 587
    username: Optional[str] = None
    password: Optional[str] = None
    from_email: str
    use_tls: bool = True


class SmtpConfigOut(BaseModel):
    id: str
    host: str
    port: int
    username: Optional[str] = None
    from_email: str
    use_tls: bool


class DashboardEmailRequest(BaseModel):
    dashboard_id: str
    recipients: List[str]
    subject: Optional[str] = None
