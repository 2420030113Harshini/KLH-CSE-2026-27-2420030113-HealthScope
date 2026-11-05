"""Dataset file storage and JSON-safe serialisation helpers."""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from ..config import DATASET_DIR


def dataset_path(dataset_id: str) -> Path:
    return DATASET_DIR / f"{dataset_id}.csv"


def save_dataframe(dataset_id: str, df: pd.DataFrame) -> int:
    path = dataset_path(dataset_id)
    df.to_csv(path, index=False)
    return path.stat().st_size


def load_dataframe(dataset_id: str) -> pd.DataFrame:
    path = dataset_path(dataset_id)
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset '{dataset_id}' is registered but its data file is missing."
        )
    df = pd.read_csv(path, low_memory=False)
    return coerce_types(df)


def coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    """Re-infer numeric / datetime columns lost during CSV round-tripping."""
    for col in df.columns:
        series = df[col]
        if series.dtype != object:
            continue
        non_null = int(series.notna().sum())
        if non_null == 0:
            continue
        numeric = pd.to_numeric(series, errors="coerce")
        if int(numeric.notna().sum()) >= 0.95 * non_null:
            df[col] = numeric
            continue
        try:
            with pd.option_context("mode.chained_assignment", None):
                dates = pd.to_datetime(series, errors="coerce", format="mixed")
            if int(dates.notna().sum()) >= 0.95 * non_null:
                df[col] = dates
        except Exception:
            pass
    return df


def jsonable(obj: Any) -> Any:
    """Convert numpy/pandas values into strict JSON-safe primitives."""
    if isinstance(obj, dict):
        return {str(k): jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [jsonable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return jsonable(obj.tolist())
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        value = float(obj)
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if obj is pd.NaT or obj is None:
        return None
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def column_profile(df: pd.DataFrame) -> dict:
    numeric, categorical, datetimes = [], [], []
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            numeric.append(col)
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            datetimes.append(col)
        else:
            categorical.append(col)
    return {
        "column_names": [str(c) for c in df.columns],
        "numeric_columns": numeric,
        "categorical_columns": categorical,
        "datetime_columns": datetimes,
    }