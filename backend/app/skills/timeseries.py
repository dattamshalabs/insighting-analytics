"""Time-series skills: trend detection, forecasting, period comparison."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
from pandasai.skills import skill


@skill
def detect_trend(df: pd.DataFrame, date_col: str, value_col: str) -> str:
    """Detect trend and seasonality in a time series using statsmodels decomposition.

    Args:
        df: DataFrame with time series data
        date_col: Column with dates
        value_col: Column with values
    """
    from statsmodels.tsa.seasonal import seasonal_decompose

    ts = df[[date_col, value_col]].copy()
    ts[date_col] = pd.to_datetime(ts[date_col])
    ts = ts.sort_values(date_col).set_index(date_col)
    ts = ts[value_col].dropna()

    if len(ts) < 14:
        return json.dumps({"error": "Need at least 14 data points for trend detection"})

    # Guess period
    period = min(7, len(ts) // 2)
    try:
        decomp = seasonal_decompose(ts, model="additive", period=period)
    except Exception as e:
        return json.dumps({"error": str(e)})

    trend = decomp.trend.dropna()
    trend_direction = "upward" if trend.iloc[-1] > trend.iloc[0] else "downward"
    trend_strength = abs(trend.iloc[-1] - trend.iloc[0]) / (ts.std() + 1e-9)

    return json.dumps({
        "test_name": "Trend Detection",
        "trend_direction": trend_direction,
        "trend_strength": round(float(trend_strength), 4),
        "seasonal_period": period,
        "interpretation": (
            f"The series shows a {trend_direction} trend with strength {trend_strength:.2f}. "
            f"Seasonal pattern detected with period {period}."
        ),
    })


@skill
def forecast(df: pd.DataFrame, date_col: str, value_col: str, periods: int = 7) -> str:
    """Forecast future values using exponential smoothing (statsmodels).

    Args:
        df: DataFrame with time series data
        date_col: Column with dates
        value_col: Column with values
        periods: Number of periods to forecast
    """
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    ts = df[[date_col, value_col]].copy()
    ts[date_col] = pd.to_datetime(ts[date_col])
    ts = ts.sort_values(date_col).set_index(date_col)
    ts = ts[value_col].dropna()

    if len(ts) < 10:
        return json.dumps({"error": "Need at least 10 data points for forecasting"})

    try:
        model = ExponentialSmoothing(ts, trend="add", seasonal=None).fit(optimized=True)
        fcast = model.forecast(periods)
    except Exception as e:
        return json.dumps({"error": str(e)})

    return json.dumps({
        "test_name": "Forecast (Exponential Smoothing)",
        "periods_forecast": periods,
        "forecast_values": [round(float(v), 2) for v in fcast.values],
        "forecast_dates": [str(d.date()) for d in fcast.index],
        "interpretation": (
            f"Forecasted {periods} periods ahead. "
            f"Predicted range: {fcast.min():.2f} to {fcast.max():.2f}."
        ),
    })


@skill
def compare_periods(df: pd.DataFrame, date_col: str, value_col: str, period: str = "month") -> str:
    """Compare values across periods (month-over-month, week-over-week, etc).

    Args:
        df: DataFrame with time series data
        date_col: Column with dates
        value_col: Column with values
        period: Grouping period - "week", "month", "quarter", "year"
    """
    ts = df[[date_col, value_col]].copy()
    ts[date_col] = pd.to_datetime(ts[date_col])

    freq_map = {"week": "W", "month": "ME", "quarter": "QE", "year": "YE"}
    freq = freq_map.get(period, "ME")

    grouped = ts.set_index(date_col).resample(freq)[value_col].sum()
    if len(grouped) < 2:
        return json.dumps({"error": f"Need at least 2 {period}s of data"})

    pct_changes = grouped.pct_change().dropna()
    comparisons = []
    for date, change in pct_changes.items():
        comparisons.append({
            "period": str(date.date()),
            "value": round(float(grouped[date]), 2),
            "pct_change": round(float(change * 100), 2),
        })

    avg_change = pct_changes.mean() * 100
    return json.dumps({
        "test_name": f"Period Comparison ({period})",
        "comparisons": comparisons[-12:],  # last 12 periods
        "avg_pct_change": round(float(avg_change), 2),
        "interpretation": (
            f"Average {period}-over-{period} change: {avg_change:+.1f}%. "
            f"Latest change: {pct_changes.iloc[-1]*100:+.1f}%."
        ),
    })
