"""Data-quality diagnostics and configurable cleaning operations."""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd


def quality_report(df: pd.DataFrame) -> Dict[str, Any]:
    n_rows = len(df)
    columns: List[Dict[str, Any]] = []

    for col in df.columns:
        s = df[col]
        missing = int(s.isna().sum())
        try:
            unique = int(s.nunique(dropna=True))
        except TypeError:
            unique = int(s.astype(str).nunique(dropna=True))

        entry: Dict[str, Any] = {
            "name": str(col),
            "dtype": str(s.dtype),
            "missing": missing,
            "missing_pct": round(missing / n_rows * 100, 2) if n_rows else 0.0,
            "unique": unique,
            "constant": unique <= 1,
            "kind": "numeric" if pd.api.types.is_numeric_dtype(s)
            else "datetime" if pd.api.types.is_datetime64_any_dtype(s)
            else "categorical",
        }

        if entry["kind"] == "numeric" and n_rows:
            clean = pd.to_numeric(s, errors="coerce").dropna()
            if not clean.empty:
                q1, q3 = float(clean.quantile(0.25)), float(clean.quantile(0.75))
                iqr = q3 - q1
                if iqr > 0:
                    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                    outliers = int(((clean < lo) | (clean > hi)).sum())
                else:
                    outliers = 0
                entry.update(
                    {
                        "outliers": outliers,
                        "min": float(clean.min()),
                        "max": float(clean.max()),
                        "mean": float(clean.mean()),
                        "median": float(clean.median()),
                        "std": float(clean.std(ddof=0)),
                    }
                )
        columns.append(entry)

    duplicate_rows = int(df.duplicated().sum())
    total_cells = n_rows * max(len(df.columns), 1)
    missing_cells = int(df.isna().sum().sum())

    warnings: List[str] = []
    if duplicate_rows:
        warnings.append(f"{duplicate_rows} fully duplicated row(s) detected.")
    if n_rows and missing_cells / total_cells > 0.2:
        warnings.append("More than 20% of all cells are missing.")
    const_cols = [c["name"] for c in columns if c["constant"]]
    if const_cols:
        warnings.append(f"{len(const_cols)} constant column(s): {', '.join(const_cols[:5])}")

    quality_score = 100.0
    if total_cells:
        quality_score -= (missing_cells / total_cells) * 60
    if n_rows:
        quality_score -= (duplicate_rows / n_rows) * 30
    quality_score -= min(len(const_cols) * 2.0, 10.0)
    quality_score = max(0.0, min(100.0, quality_score))

    return {
        "rows": n_rows,
        "num_columns": len(df.columns),
        "duplicate_rows": duplicate_rows,
        "missing_cells": missing_cells,
        "missing_pct": round(missing_cells / total_cells * 100, 2) if total_cells else 0.0,
        "constant_columns": const_cols,
        "quality_score": round(quality_score, 1),
        "warnings": warnings,
        "columns": columns,
    }


def apply_cleaning(
    df: pd.DataFrame, operations: List[Dict[str, Any]]
) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
    """Apply cleaning operations to a COPY. The original dataset is never mutated."""
    work = df.copy()
    log: List[Dict[str, Any]] = []

    for op in operations or []:
        name = (op.get("operation") or "").strip()
        before_rows, before_cols = work.shape

        try:
            if name == "drop_duplicates":
                work = work.drop_duplicates().reset_index(drop=True)

            elif name == "drop_columns":
                cols = [c for c in (op.get("columns") or []) if c in work.columns]
                work = work.drop(columns=cols)

            elif name == "drop_rows_missing":
                cols = [c for c in (op.get("columns") or []) if c in work.columns] or None
                how = op.get("how") or "any"
                work = work.dropna(subset=cols, how=how).reset_index(drop=True)

            elif name == "impute_numeric":
                col = op.get("column")
                strategy = op.get("strategy") or "median"
                if col in work.columns:
                    numeric = pd.to_numeric(work[col], errors="coerce")
                    if strategy == "mean":
                        fill = numeric.mean()
                    elif strategy == "zero":
                        fill = 0
                    elif strategy == "value":
                        fill = float(op.get("value") or 0)
                    else:
                        fill = numeric.median()
                    work[col] = numeric.fillna(fill)

            elif name == "impute_categorical":
                col = op.get("column")
                strategy = op.get("strategy") or "mode"
                if col in work.columns:
                    if strategy == "value":
                        fill = op.get("value")
                        if fill is None:
                            fill = "Unknown"
                    else:
                        modes = work[col].mode(dropna=True)
                        fill = modes.iloc[0] if not modes.empty else "Unknown"
                    work[col] = work[col].fillna(fill)

            elif name == "convert_type":
                col, to = op.get("column"), (op.get("to") or "string")
                if col in work.columns:
                    if to == "numeric":
                        work[col] = pd.to_numeric(work[col], errors="coerce")
                    elif to == "string":
                        work[col] = work[col].astype(str).replace({"nan": np.nan})
                    elif to == "datetime":
                        work[col] = pd.to_datetime(work[col], errors="coerce", format="mixed")
                    elif to == "category":
                        work[col] = work[col].astype("category")

            elif name == "scale":
                cols = [c for c in (op.get("columns") or []) if c in work.columns]
                method = op.get("method") or "standardize"
                for col in cols:
                    numeric = pd.to_numeric(work[col], errors="coerce")
                    if method == "normalize":
                        lo, hi = numeric.min(), numeric.max()
                        work[col] = (numeric - lo) / (hi - lo) if hi > lo else 0.0
                    else:
                        std = numeric.std(ddof=0)
                        work[col] = (
                            (numeric - numeric.mean()) / std if std and std > 0 else 0.0
                        )

            elif name == "encode":
                cols = [c for c in (op.get("columns") or []) if c in work.columns]
                method = op.get("method") or "onehot"
                for col in cols:
                    if method == "ordinal":
                        work[col] = work[col].astype("category").cat.codes
                    else:
                        dummies = pd.get_dummies(
                            work[col].astype(str), prefix=col, dummy_na=False
                        )
                        work = pd.concat([work.drop(columns=[col]), dummies], axis=1)

            elif name == "replace_outliers":
                col = op.get("column")
                if col in work.columns:
                    numeric = pd.to_numeric(work[col], errors="coerce")
                    q1, q3 = numeric.quantile(0.25), numeric.quantile(0.75)
                    iqr = q3 - q1
                    if iqr > 0:
                        lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                        work[col] = numeric.clip(lower=lo, upper=hi)

            else:
                log.append(
                    {
                        "operation": name,
                        "status": "skipped",
                        "detail": "Unsupported operation.",
                    }
                )
                continue

        except Exception as exc:  # pragma: no cover - defensive
            log.append(
                {"operation": name, "status": "error", "detail": str(exc)}
            )
            continue

        log.append(
            {
                "operation": name,
                "status": "applied",
                "detail": f"rows {before_rows} -> {work.shape[0]}, "
                f"columns {before_cols} -> {work.shape[1]}",
                "params": {k: v for k, v in op.items() if k != "operation"},
            }
        )

    return work.reset_index(drop=True), log