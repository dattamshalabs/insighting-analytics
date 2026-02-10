"""Pydantic request / response models."""

from __future__ import annotations

import datetime
import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    created_at: datetime.datetime
    last_login_at: Optional[datetime.datetime] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10000)
    session_id: Optional[str] = Field(None, max_length=100)
    datasource_id: Optional[str] = Field(None, max_length=100)


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
    name: str = Field(..., min_length=1, max_length=255)
    db_type: str = Field("postgresql", pattern=r"^(postgresql|mysql|mssql|databricks|csv|excel)$")
    host: Optional[str] = Field(None, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    database: Optional[str] = Field(None, max_length=255)
    username: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = Field(None, max_length=1000)
    ssl_mode: str = Field("disable", pattern=r"^(disable|require|verify-ca|verify-full)$")
    is_default: bool = False
    # Databricks-specific
    http_path: Optional[str] = Field(None, max_length=500)
    catalog: Optional[str] = Field(None, max_length=255)
    access_token: Optional[str] = Field(None, max_length=1000)


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
    name: str = Field(..., min_length=1, max_length=255)
    datasource_id: Optional[str] = Field(None, max_length=100)
    query: str = Field(..., min_length=1, max_length=10000)
    cron_expression: str = Field("0 9 * * *", max_length=100)
    threshold_condition: str = Field(..., min_length=1, max_length=500)
    webhook_url: Optional[str] = Field(None, max_length=2000)
    enabled: bool = True

    @field_validator("cron_expression")
    @classmethod
    def validate_cron(cls, v: str) -> str:
        """Validate cron expression format."""
        parts = v.strip().split()
        if len(parts) != 5:
            raise ValueError("Cron expression must have 5 space-separated fields")
        # Basic validation of each field
        for i, part in enumerate(parts):
            if not re.match(r'^[\d,\-\*/]+$', part):
                raise ValueError(f"Invalid cron field at position {i+1}: {part}")
        return v

    @field_validator("threshold_condition")
    @classmethod
    def validate_threshold(cls, v: str) -> str:
        """Validate threshold condition is safe for evaluation."""
        # Only allow: result, numbers, comparison ops, boolean ops, parentheses, spaces
        allowed_pattern = r'^[\s\d\.\(\)]+$|^[\s]*result[\s]*(>|<|>=|<=|==|!=)[\s]*[\d\.]+[\s]*(and|or)?[\s]*.*$'
        if not re.match(r'^[result\s\d\.<>=!andor\(\)]+$', v, re.IGNORECASE):
            raise ValueError("Threshold condition contains invalid characters")
        return v


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


class AlertConnectorCreate(BaseModel):
    connector_type: str = Field(..., pattern=r"^(email|slack|sftp)$")
    config: Dict[str, Any]
    enabled: bool = True


class AlertConnectorOut(BaseModel):
    id: str
    alert_id: str
    connector_type: str
    enabled: bool
    created_at: datetime.datetime


# ---------------------------------------------------------------------------
# Glossary
# ---------------------------------------------------------------------------

class GlossaryTermCreate(BaseModel):
    term: str = Field(..., min_length=1, max_length=255)
    sql_expression: str = Field(..., min_length=1, max_length=5000)
    description: Optional[str] = Field(None, max_length=2000)
    formula_type: str = Field("expression", pattern=r"^(expression|calculation|metric)$")
    result_type: str = Field("numeric", pattern=r"^(numeric|string|boolean)$")


class GlossaryTermUpdate(BaseModel):
    term: Optional[str] = None
    sql_expression: Optional[str] = None
    description: Optional[str] = None
    formula_type: Optional[str] = Field(None, pattern=r"^(expression|calculation|metric)$")
    result_type: Optional[str] = Field(None, pattern=r"^(numeric|string|boolean)$")


class GlossaryTermOut(BaseModel):
    id: str
    term: str
    sql_expression: str
    description: Optional[str] = None
    formula_type: str = "expression"
    result_type: str = "numeric"
    dependencies: List[str] = []
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
    title: str = Field(..., min_length=1, max_length=255)


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
    prompt: str = Field(..., min_length=1, max_length=5000)
    datasource_id: Optional[str] = Field(None, max_length=100)


class DashboardOut(BaseModel):
    id: str
    title: str
    datasource_id: Optional[str] = None
    prompt: Optional[str] = None
    widgets: List[DashboardWidget] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime


class DashboardIterateRequest(BaseModel):
    feedback: str = Field(..., min_length=1, max_length=5000)


class DashboardIterationOut(BaseModel):
    id: str
    dashboard_id: str
    iteration_number: int
    feedback: str
    created_at: datetime.datetime


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
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(587, ge=1, le=65535)
    username: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = Field(None, max_length=1000)
    from_email: EmailStr
    use_tls: bool = True


class SmtpConfigOut(BaseModel):
    id: str
    host: str
    port: int
    username: Optional[str] = None
    from_email: str
    use_tls: bool


class DashboardEmailRequest(BaseModel):
    dashboard_id: str = Field(..., max_length=100)
    recipients: List[EmailStr] = Field(..., min_length=1, max_length=50)
    subject: Optional[str] = Field(None, max_length=500)
