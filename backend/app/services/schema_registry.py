"""Auto-introspect tables, columns, FK/inferred joins, cache metadata."""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional, Tuple

from sqlalchemy import create_engine, inspect, text

from app.core.config import settings
from app.models.schemas import ColumnInfo, InferredRelation, SchemaMap, TableInfo

logger = logging.getLogger(__name__)

# In-memory registry keyed by datasource_id
_registry: Dict[str, SchemaMap] = {}


def _get_engine(connection_string: str):
    return create_engine(connection_string, pool_pre_ping=True)


def introspect(datasource_id: str, connection_string: str) -> SchemaMap:
    """Introspect a PostgreSQL datasource and cache the schema map."""
    engine = _get_engine(connection_string)
    inspector = inspect(engine)

    tables: List[TableInfo] = []
    all_columns: Dict[str, List[ColumnInfo]] = {}
    explicit_relations: List[InferredRelation] = []

    for table_name in inspector.get_table_names(schema="public"):
        pk_cols = set(inspector.get_pk_constraint(table_name, schema="public").get("constrained_columns", []))
        columns: List[ColumnInfo] = []

        for col in inspector.get_columns(table_name, schema="public"):
            columns.append(ColumnInfo(
                name=col["name"],
                data_type=str(col["type"]),
                nullable=col.get("nullable", True),
                is_primary_key=col["name"] in pk_cols,
            ))

        # Explicit FK relations
        for fk in inspector.get_foreign_keys(table_name, schema="public"):
            ref_table = fk["referred_table"]
            for local_col, remote_col in zip(fk["constrained_columns"], fk["referred_columns"]):
                # Mark column
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

        # Row count (fast estimate)
        row_count = None
        try:
            with engine.connect() as conn:
                result = conn.execute(
                    text(f"SELECT reltuples::bigint FROM pg_class WHERE relname = :t"),
                    {"t": table_name},
                )
                row = result.fetchone()
                if row:
                    row_count = max(int(row[0]), 0)
        except Exception:
            pass

        tables.append(TableInfo(
            name=table_name,
            schema_name="public",
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
    logger.info("Schema introspected for datasource %s: %d tables, %d relations",
                datasource_id, len(tables), len(schema_map.relations))
    return schema_map


def _infer_relations(
    all_columns: Dict[str, List[ColumnInfo]],
    explicit: List[InferredRelation],
) -> List[InferredRelation]:
    """Infer joins by column name matching (e.g. orders.user_id -> users.id)."""
    explicit_set = {(r.from_table, r.from_column, r.to_table, r.to_column) for r in explicit}
    inferred: List[InferredRelation] = []

    table_names = list(all_columns.keys())
    # Build lookup: table -> set of column names
    col_lookup = {t: {c.name for c in cols} for t, cols in all_columns.items()}

    for table_a in table_names:
        for col in all_columns[table_a]:
            # Pattern: <other_table>_id or <other_table>Id
            match = re.match(r"^(.+?)_id$", col.name, re.IGNORECASE)
            if not match:
                continue
            candidate = match.group(1).lower()
            # Look for a table whose name matches candidate (singular or plural)
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
