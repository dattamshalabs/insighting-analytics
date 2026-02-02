"""Auto data profiling on datasource connect."""

from __future__ import annotations

import logging
from typing import List

from sqlalchemy import create_engine, inspect, text

from app.models.schemas import ColumnProfile, TableProfile

logger = logging.getLogger(__name__)


def profile_datasource(connection_string: str) -> List[TableProfile]:
    """Profile all tables in a datasource: row counts, column stats."""
    engine = create_engine(connection_string, pool_pre_ping=True)
    inspector = inspect(engine)
    profiles: List[TableProfile] = []

    for table_name in inspector.get_table_names(schema="public"):
        try:
            profile = _profile_table(engine, table_name)
            profiles.append(profile)
        except Exception as e:
            logger.warning("Failed to profile table %s: %s", table_name, e)

    logger.info("Profiled %d tables", len(profiles))
    return profiles


def _profile_table(engine, table_name: str) -> TableProfile:
    columns: List[ColumnProfile] = []

    with engine.connect() as conn:
        # Row count
        result = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
        row_count = result.scalar() or 0

        # Column info
        col_result = conn.execute(text(
            "SELECT column_name, data_type "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t "
            "ORDER BY ordinal_position"
        ), {"t": table_name})

        for col_name, data_type in col_result:
            cp = ColumnProfile(name=col_name, data_type=data_type)

            if row_count > 0:
                try:
                    # Null percentage
                    null_res = conn.execute(text(
                        f'SELECT COUNT(*) FILTER (WHERE "{col_name}" IS NULL) FROM "{table_name}"'
                    ))
                    null_count = null_res.scalar() or 0
                    cp.null_pct = round(null_count / row_count * 100, 2)

                    # Cardinality
                    card_res = conn.execute(text(
                        f'SELECT COUNT(DISTINCT "{col_name}") FROM "{table_name}"'
                    ))
                    cp.cardinality = card_res.scalar() or 0

                    # Numeric stats
                    if data_type in ("integer", "bigint", "smallint", "numeric", "real", "double precision"):
                        stats_res = conn.execute(text(
                            f'SELECT MIN("{col_name}"), MAX("{col_name}"), AVG("{col_name}"::numeric) FROM "{table_name}"'
                        ))
                        row = stats_res.fetchone()
                        if row:
                            cp.min_value = row[0]
                            cp.max_value = row[1]
                            cp.mean_value = round(float(row[2]), 4) if row[2] is not None else None

                    # Sample values (first 5 distinct)
                    sample_res = conn.execute(text(
                        f'SELECT DISTINCT "{col_name}" FROM "{table_name}" WHERE "{col_name}" IS NOT NULL LIMIT 5'
                    ))
                    cp.sample_values = [str(r[0]) for r in sample_res]

                except Exception as e:
                    logger.debug("Column profiling failed for %s.%s: %s", table_name, col_name, e)

            columns.append(cp)

    return TableProfile(
        table_name=table_name,
        row_count=row_count,
        column_count=len(columns),
        columns=columns,
    )
