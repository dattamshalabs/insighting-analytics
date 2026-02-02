"""PandasAI custom skills: ANOVA, anomaly detection."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from pandasai.skills import skill
from scipy import stats


@skill
def anova_test(df: pd.DataFrame, group_col: str, value_col: str) -> str:
    """Perform one-way ANOVA test to compare means across groups.

    Args:
        df: DataFrame with the data
        group_col: Column containing group labels
        value_col: Column containing numeric values to compare
    """
    groups = [group[value_col].dropna().values for _, group in df.groupby(group_col)]
    if len(groups) < 2:
        return json.dumps({"error": "Need at least 2 groups for ANOVA"})

    f_stat, p_value = stats.f_oneway(*groups)

    sig = "statistically significant" if p_value < 0.05 else "not statistically significant"
    interpretation = (
        f"F({len(groups)-1}, {sum(len(g) for g in groups)-len(groups)}) = {f_stat:.4f}, "
        f"p = {p_value:.6f}. The difference between groups is {sig} at α=0.05."
    )

    return json.dumps({
        "test_name": "One-way ANOVA",
        "statistic": round(float(f_stat), 4),
        "p_value": round(float(p_value), 6),
        "interpretation": interpretation,
        "details": {
            "n_groups": len(groups),
            "group_sizes": [len(g) for g in groups],
        },
    })


@skill
def detect_anomalies(df: pd.DataFrame, value_col: str, method: str = "iqr") -> str:
    """Detect anomalies in a numeric column using IQR or Z-score method.

    Args:
        df: DataFrame with the data
        value_col: Numeric column to check for anomalies
        method: Detection method - "iqr" or "zscore"
    """
    series = df[value_col].dropna()
    if len(series) < 10:
        return json.dumps({"error": "Need at least 10 data points for anomaly detection"})

    if method == "zscore":
        z = np.abs(stats.zscore(series))
        mask = z > 3
    else:  # iqr
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        mask = (series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)

    anomalies = series[mask]
    return json.dumps({
        "test_name": f"Anomaly Detection ({method.upper()})",
        "anomaly_count": int(anomalies.sum()) if isinstance(mask.sum(), (int, np.integer)) else int(mask.sum()),
        "anomaly_pct": round(float(mask.mean() * 100), 2),
        "anomaly_indices": anomalies.index.tolist()[:20],
        "interpretation": f"Found {int(mask.sum())} anomalies ({mask.mean()*100:.1f}%) in '{value_col}' using {method.upper()} method.",
        "details": {
            "mean": round(float(series.mean()), 4),
            "std": round(float(series.std()), 4),
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
        },
    })


@skill
def correlation_matrix(df: pd.DataFrame) -> str:
    """Compute correlation matrix for all numeric columns.

    Args:
        df: DataFrame with the data
    """
    numeric = df.select_dtypes(include=["number"])
    if numeric.shape[1] < 2:
        return json.dumps({"error": "Need at least 2 numeric columns"})

    corr = numeric.corr()
    # Find strong correlations
    strong = []
    for i in range(len(corr.columns)):
        for j in range(i + 1, len(corr.columns)):
            val = corr.iloc[i, j]
            if abs(val) > 0.7:
                strong.append({
                    "col1": corr.columns[i],
                    "col2": corr.columns[j],
                    "correlation": round(float(val), 4),
                })

    return json.dumps({
        "test_name": "Correlation Matrix",
        "strong_correlations": strong,
        "interpretation": f"Found {len(strong)} strong correlations (|r| > 0.7) among {numeric.shape[1]} numeric columns.",
    })
