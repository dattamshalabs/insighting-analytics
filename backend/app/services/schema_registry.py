"""Auto-introspect tables, columns, FK/inferred joins, cache metadata."""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional

from sqlalchemy import create_engine, inspect, text

from app.core.config import settings
from app.models.schemas import ColumnInfo, InferredRelation, SchemaMap, TableInfo
from app.services.db_engine import get_default_schema, get_row_count_query

logger = logging.getLogger(__name__)

# In-memory registry keyed by datasource_id
_registry: Dict[str, SchemaMap] = {}


def _get_engine(connection_string: str):
    return create_engine(connection_string, pool_pre_ping=True)


def introspect(datasource_id: str, connection_string: str, db_type: str = "postgresql") -> SchemaMap:
    """Introspect a datasource and cache the schema map."""
    engine = _get_engine(connection_string)
    inspector = inspect(engine)
    schema_name = get_default_schema(db_type) or None

    tables: List[TableInfo] = []
    all_columns: Dict[str, List[ColumnInfo]] = {}
    explicit_relations: List[InferredRelation] = []

    # For MySQL, schema_name is None (uses current database)
    inspect_schema = schema_name if schema_name else None

    for table_name in inspector.get_table_names(schema=inspect_schema):
        pk_constraint = inspector.get_pk_constraint(table_name, schema=inspect_schema)
        pk_cols = set(pk_constraint.get("constrained_columns", []) if pk_constraint else [])
        columns: List[ColumnInfo] = []

        for col in inspector.get_columns(table_name, schema=inspect_schema):
            columns.append(ColumnInfo(
                name=col["name"],
                data_type=str(col["type"]),
                nullable=col.get("nullable", True),
                is_primary_key=col["name"] in pk_cols,
            ))

        # Explicit FK relations
        try:
            for fk in inspector.get_foreign_keys(table_name, schema=inspect_schema):
                ref_table = fk["referred_table"]
                for local_col, remote_col in zip(fk["constrained_columns"], fk["referred_columns"]):
                    for c in columns:
                        if c.name == local_col:
                            c.is_foreign_key = True
                            c.references = f"{ref_table}.{remote_col}"
                    explicit_relations.append(InferredRelation(
                        from_table=table_name,
                        from_column=local_col,
                        to_table=ref_table,
                        to_column=remote_col,
                        confidence=1.0,
                        relation_type="explicit",
                    ))
        except Exception:
            pass  # Some databases may not support FK introspection

        # Row count (fast estimate, using parameterized query)
        row_count = None
        count_query, query_params = get_row_count_query(db_type, table_name)
        if count_query:
            try:
                with engine.connect() as conn:
                    result = conn.execute(text(count_query), query_params)
                    row = result.fetchone()
                    if row:
                        row_count = max(int(row[0]), 0)
            except Exception:
                pass

        tables.append(TableInfo(
            name=table_name,
            schema_name=schema_name or "default",
            row_count=row_count,
            columns=columns,
        ))
        all_columns[table_name] = columns

    # Infer implicit relations
    inferred = _infer_relations(all_columns, explicit_relations)

    schema_map = SchemaMap(
        datasource_id=datasource_id,
        tables=tables,
        relations=explicit_relations + inferred,
    )
    _registry[datasource_id] = schema_map
    logger.info("Schema introspected for datasource %s (%s): %d tables, %d relations",
                datasource_id, db_type, len(tables), len(schema_map.relations))
    return schema_map


def _infer_relations(
    all_columns: Dict[str, List[ColumnInfo]],
    explicit: List[InferredRelation],
) -> List[InferredRelation]:
    """Infer joins by column name matching (e.g. orders.user_id -> users.id)."""
    explicit_set = {(r.from_table, r.from_column, r.to_table, r.to_column) for r in explicit}
    inferred: List[InferredRelation] = []

    table_names = list(all_columns.keys())
    col_lookup = {t: {c.name for c in cols} for t, cols in all_columns.items()}

    for table_a in table_names:
        for col in all_columns[table_a]:
            match = re.match(r"^(.+?)_id$", col.name, re.IGNORECASE)
            if not match:
                continue
            candidate = match.group(1).lower()
            for table_b in table_names:
                if table_b == table_a:
                    continue
                tb_lower = table_b.lower()
                if tb_lower == candidate or tb_lower == candidate + "s" or tb_lower.rstrip("s") == candidate:
                    if "id" in col_lookup[table_b]:
                        key = (table_a, col.name, table_b, "id")
                        if key not in explicit_set:
                            confidence = 0.9 if tb_lower == candidate or tb_lower == candidate + "s" else 0.7
                            inferred.append(InferredRelation(
                                from_table=table_a,
                                from_column=col.name,
                                to_table=table_b,
                                to_column="id",
                                confidence=confidence,
                                relation_type="inferred",
                            ))

    return inferred


def get_schema(datasource_id: str) -> Optional[SchemaMap]:
    return _registry.get(datasource_id)


def get_schema_context(datasource_id: str) -> str:
    """Return a text summary of the schema for LLM context."""
    schema = _registry.get(datasource_id)
    if not schema:
        return ""
    lines = ["Database schema:"]
    for t in schema.tables:
        cols = ", ".join(f"{c.name} ({c.data_type})" for c in t.columns)
        lines.append(f"  Table {t.name}: {cols}")
    if schema.relations:
        lines.append("Relationships:")
        for r in schema.relations:
            lines.append(f"  {r.from_table}.{r.from_column} -> {r.to_table}.{r.to_column} ({r.relation_type}, confidence={r.confidence})")
    return "\n".join(lines)


def clear(datasource_id: Optional[str] = None) -> None:
    if datasource_id:
        _registry.pop(datasource_id, None)
    else:
        _registry.clear()


# Table-specific question templates for dynamic suggestions
_QUESTION_TEMPLATES: Dict[str, List[str]] = {
    "employees": [
        "What is the current headcount by department?",
        "Show me the gender diversity breakdown across locations",
        "What is the average salary by job level?",
        "Which departments have the most employees?",
        "How has headcount changed over time by hire date?",
    ],
    "attrition": [
        "What is our attrition rate by department?",
        "Show me voluntary vs involuntary termination trends",
        "What are the top reasons for employee attrition?",
        "Which departments have the highest voluntary turnover?",
        "What is the average tenure of employees who left?",
    ],
    "pulse_survey_responses": [
        "What is the average engagement score by department?",
        "Show me employee satisfaction trends over time",
        "Which department has the best work-life balance scores?",
        "Compare manager effectiveness scores across teams",
        "What percentage of employees would recommend the company?",
    ],
    "pulse_surveys": [
        "What is the survey response rate trend?",
        "Compare Q1 vs Q4 engagement survey results",
    ],
    "learning_development": [
        "Which employees completed the most training courses?",
        "What is the training completion rate by department?",
        "Show me the most popular course categories",
        "What is the average training score by department?",
        "How much are we spending on learning and development?",
    ],
    "recognition": [
        "Who received the most recognition awards?",
        "Show me recognition distribution by category",
        "Which department gives out the most recognition?",
        "What is the trend of recognition awards over time?",
        "How much monetary value has been awarded in recognition?",
    ],
    "departments": [
        "List all departments with their cost centers",
        "How many employees are in each department?",
    ],
    "locations": [
        "Show me employee distribution by location",
        "Which regions have the most headcount?",
    ],
    "job_levels": [
        "What is the salary range by job level?",
        "How many employees are at each level?",
    ],
}

# Generic templates for unknown tables
_GENERIC_TEMPLATES = [
    "Show me the total count of records in {table}",
    "What are the top 10 records in {table}?",
    "Show me {table} breakdown by category",
]


def get_suggested_questions(datasource_id: str, max_questions: int = 8) -> List[str]:
    """Generate contextual suggested questions based on available tables."""
    schema = _registry.get(datasource_id)
    if not schema:
        return []

    questions: List[str] = []
    table_names = {t.name.lower() for t in schema.tables}

    # Priority order for HR analytics tables
    priority_tables = [
        "employees", "attrition", "pulse_survey_responses",
        "learning_development", "recognition", "departments"
    ]

    # Add questions from priority tables first
    for table in priority_tables:
        if table in table_names and table in _QUESTION_TEMPLATES:
            # Add 1-2 questions per priority table
            for q in _QUESTION_TEMPLATES[table][:2]:
                if len(questions) < max_questions:
                    questions.append(q)

    # If we still need more questions, add from remaining matched tables
    for table in table_names:
        if table in _QUESTION_TEMPLATES and len(questions) < max_questions:
            for q in _QUESTION_TEMPLATES[table]:
                if q not in questions and len(questions) < max_questions:
                    questions.append(q)

    # If still not enough, add generic questions for other tables
    for t in schema.tables:
        if len(questions) >= max_questions:
            break
        if t.name.lower() not in _QUESTION_TEMPLATES:
            for template in _GENERIC_TEMPLATES[:1]:
                if len(questions) < max_questions:
                    questions.append(template.format(table=t.name))

    return questions[:max_questions]
