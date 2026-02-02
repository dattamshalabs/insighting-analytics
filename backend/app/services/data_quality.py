"""Data quality checks: nulls, duplicates, outliers, freshness, type consistency."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import pandas as pd

from app.models.schemas import DataQualityIssue, DataQualityReport

logger = logging.getLogger(__name__)


def check_dataframe(df: pd.DataFrame, table_total_rows: Optional[int] = None) -> DataQualityReport:
    """Run all quality checks on a result DataFrame."""
    if df is None or df.empty:
        return DataQualityReport(issues=[], overall_score=1.0)

    issues: List[DataQualityIssue] = []
    issues.extend(_check_completeness(df))
    issues.extend(_check_uniqueness(df))
    issues.extend(_check_outliers(df))
    issues.extend(_check_type_consistency(df))
    issues.extend(_check_volume(df, table_total_rows))
    issues.extend(_check_freshness(df))

    # Score: 1.0 minus penalty per issue
    penalties = {"error": 0.15, "warning": 0.05, "info": 0.01}
    score = max(0.0, 1.0 - sum(penalties.get(i.severity, 0) for i in issues))

    return DataQualityReport(issues=issues, overall_score=round(score, 2))


def _check_completeness(df: pd.DataFrame) -> List[DataQualityIssue]:
    issues = []
    for col in df.columns:
        null_rate = df[col].isna().mean()
        if null_rate > 0.5:
            issues.append(DataQualityIssue(
                column=col, check="completeness", severity="error",
                message=f"Column '{col}' has {null_rate:.0%} null values",
                value=round(null_rate, 3),
            ))
        elif null_rate > 0.1:
            issues.append(DataQualityIssue(
                column=col, check="completeness", severity="warning",
                message=f"Column '{col}' has {null_rate:.0%} null values",
                value=round(null_rate, 3),
            ))
    return issues


def _check_uniqueness(df: pd.DataFrame) -> List[DataQualityIssue]:
    issues = []
    for col in df.columns:
        if df[col].dtype == "object" or "id" in col.lower():
            dup_rate = 1 - df[col].nunique() / max(len(df), 1)
            if "id" in col.lower() and dup_rate > 0.01 and len(df) > 10:
                issues.append(DataQualityIssue(
                    column=col, check="uniqueness", severity="warning",
                    message=f"ID column '{col}' has {dup_rate:.1%} duplicate rate",
                    value=round(dup_rate, 3),
                ))
    return issues


def _check_outliers(df: pd.DataFrame) -> List[DataQualityIssue]:
    issues = []
    numeric_cols = df.select_dtypes(include=["number"]).columns
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) < 10:
            continue
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        outlier_count = ((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).sum()
        outlier_pct = outlier_count / len(series)
        if outlier_pct > 0.05:
            issues.append(DataQualityIssue(
                column=col, check="outlier", severity="warning",
                message=f"Column '{col}' has {outlier_pct:.1%} outliers (IQR method)",
                value=int(outlier_count),
            ))
    return issues


def _check_type_consistency(df: pd.DataFrame) -> List[DataQualityIssue]:
    issues = []
    for col in df.columns:
        if df[col].dtype == "object":
            non_null = df[col].dropna()
            if len(non_null) == 0:
                continue
            types = non_null.apply(type).nunique()
            if types > 1:
                issues.append(DataQualityIssue(
                    column=col, check="type_consistency", severity="warning",
                    message=f"Column '{col}' contains mixed types",
                ))
    return issues


def _check_volume(df: pd.DataFrame, table_total: Optional[int]) -> List[DataQualityIssue]:
    issues = []
    if table_total and table_total > 100 and len(df) < table_total * 0.001:
        issues.append(DataQualityIssue(
            check="volume", severity="info",
            message=f"Result set ({len(df)} rows) is very small relative to source table ({table_total} rows)",
            value=len(df),
        ))
    return issues


def _check_freshness(df: pd.DataFrame) -> List[DataQualityIssue]:
    issues = []
    date_cols = df.select_dtypes(include=["datetime64", "datetimetz"]).columns
    for col in date_cols:
        if any(kw in col.lower() for kw in ["updated", "created", "modified", "timestamp"]):
            max_date = df[col].max()
            if pd.notna(max_date):
                age = pd.Timestamp.utcnow() - pd.Timestamp(max_date)
                if age.days > 30:
                    issues.append(DataQualityIssue(
                        column=col, check="freshness", severity="warning",
                        message=f"Latest '{col}' is {age.days} days old — data may be stale",
                        value=age.days,
                    ))
    return issues
