"""Exploratory analysis: filters, chart aggregation, correlation, statistics."""
from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import pandas as pd


def apply_filters(df: pd.DataFrame, filters: List[Dict[str, Any]] | None) -> pd.DataFrame:
    result = df
    for f in filters or []:
        col = f.get("column")
        op = (f.get("op") or "eq").lower()
        value = f.get("value")
        if col not in result.columns:
            continue
        series = result[col]
        try:
            if op == "eq":
                mask = series.astype(str) == str(value)
            elif op == "ne":
                mask = series.astype(str) != str(value)
            elif op == "contains":
                mask = series.astype(str).str.contains(str(value), case=False, na=False)
            elif op == "gt":
                mask = pd.to_numeric(series, errors="coerce") > float(value)
            elif op == "gte":
                mask = pd.to_numeric(series, errors="coerce") >= float(value)
            elif op == "lt":
                mask = pd.to_numeric(series, errors="coerce") < float(value)
            elif op == "lte":
                mask = pd.to_numeric(series, errors="coerce") <= float(value)
            elif op == "between":
                lo, hi = (value or [None, None])[:2]
                numeric = pd.to_numeric(series, errors="coerce")
                mask = (numeric >= float(lo)) & (numeric <= float(hi))
            elif op == "in":
                options = value if isinstance(value, list) else [value]
                mask = series.astype(str).isin([str(v) for v in options])
            else:
                continue
            result = result[mask]
        except Exception:
            continue
    return result


def _agg(series: pd.Series, how: str) -> float:
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if numeric.empty:
        return 0.0
    how = (how or "mean").lower()
    if how == "sum":
        return float(numeric.sum())
    if how == "median":
        return float(numeric.median())
    if how == "max":
        return float(numeric.max())
    if how == "min":
        return float(numeric.min())
    if how == "count":
        return float(numeric.count())
    return float(numeric.mean())


def compute_chart(df: pd.DataFrame, spec: Dict[str, Any]) -> Dict[str, Any]:
    chart_type = (spec.get("chart_type") or "histogram").lower()
    x = spec.get("x")
    y = spec.get("y")
    group_by = spec.get("group_by")
    bins = max(2, min(int(spec.get("bins") or 20), 100))
    agg = spec.get("agg") or "mean"
    top_n = max(1, min(int(spec.get("top_n") or 15), 50))

    data = apply_filters(df, spec.get("filters"))
    if data.empty:
        raise ValueError("No rows match the current filters.")

    base = {
        "chart_type": chart_type,
        "x_label": x or "",
        "y_label": y or "Count",
        "n": int(len(data)),
    }

    if chart_type == "histogram":
        if not x or x not in data.columns:
            raise ValueError("Choose a numeric column for the X axis.")
        values = pd.to_numeric(data[x], errors="coerce").dropna()
        if values.empty:
            raise ValueError(f"Column '{x}' contains no usable numeric values.")
        counts, edges = np.histogram(values, bins=bins)
        rows = [
            {
                "label": f"{edges[i]:.4g} – {edges[i + 1]:.4g}",
                "value": int(counts[i]),
                "lower": float(edges[i]),
                "upper": float(edges[i + 1]),
            }
            for i in range(len(counts))
        ]
        return {**base, "x_key": "label", "y_key": "value", "data": rows}

    if chart_type == "bar":
        if not x or x not in data.columns:
            raise ValueError("Choose a column for the X axis.")
        grouped = data.groupby(data[x].astype(str), dropna=False)
        if y and y in data.columns:
            rows = [
                {"label": str(k), "value": _agg(g[y], agg), "n": int(len(g))}
                for k, g in grouped
            ]
        else:
            rows = [
                {"label": str(k), "value": int(len(g)), "n": int(len(g))}
                for k, g in grouped
            ]
        rows.sort(key=lambda r: r["value"], reverse=True)
        rows = rows[:top_n]
        return {
            **base,
            "x_key": "label",
            "y_key": "value",
            "y_label": y if y else "Count",
            "data": rows,
        }

    if chart_type == "line":
        if not x or not y:
            raise ValueError("Line charts need both an X column and a numeric Y column.")
        if x not in data.columns or y not in data.columns:
            raise ValueError("Selected columns are not present in the dataset.")

        frame = data[[x, y] + ([group_by] if group_by in data.columns else [])].copy()
        frame["__x"] = frame[x]
        if pd.api.types.is_datetime64_any_dtype(frame["__x"]):
            frame["__x"] = frame["__x"].dt.strftime("%Y-%m-%d")
        else:
            frame["__x"] = frame["__x"].astype(str)
        frame["__y"] = pd.to_numeric(frame[y], errors="coerce")
        frame = frame.dropna(subset=["__y"])

        if group_by and group_by in frame.columns:
            pivot = (
                frame.groupby(["__x", group_by])["__y"].mean().reset_index()
            )
            wide = pivot.pivot(index="__x", columns=group_by, values="__y")
            wide = wide.sort_index()
            wide = wide.head(500)
            rows = []
            for idx, row in wide.iterrows():
                entry = {"label": str(idx)}
                for col in wide.columns:
                    val = row[col]
                    entry[str(col)] = None if pd.isna(val) else float(val)
                rows.append(entry)
            return {
                **base,
                "x_key": "label",
                "y_key": "value",
                "series": [str(c) for c in wide.columns],
                "data": rows,
            }

        series = frame.groupby("__x")["__y"].mean().sort_index().head(500)
        rows = [{"label": str(k), "value": float(v)} for k, v in series.items()]
        return {
            **base,
            "x_key": "label",
            "y_key": "value",
            "series": ["value"],
            "data": rows,
        }

    if chart_type == "scatter":
        if not x or not y:
            raise ValueError("Scatter plots need numeric X and Y columns.")
        frame = data[[x, y] + ([group_by] if group_by in data.columns else [])].copy()
        frame["__x"] = pd.to_numeric(frame[x], errors="coerce")
        frame["__y"] = pd.to_numeric(frame[y], errors="coerce")
        frame = frame.dropna(subset=["__x", "__y"])
        if frame.empty:
            raise ValueError("No rows have valid values for both selected columns.")
        if len(frame) > 4000:
            frame = frame.sample(4000, random_state=42)

        if group_by and group_by in frame.columns:
            groups = frame[group_by].astype(str).unique().tolist()[:12]
            series = []
            for g in groups:
                sub = frame[frame[group_by].astype(str) == g]
                series.append(
                    {
                        "name": g,
                        "points": [
                            {"x": float(a), "y": float(b)}
                            for a, b in zip(sub["__x"], sub["__y"])
                        ],
                    }
                )
            return {**base, "x_key": "x", "y_key": "y", "series_data": series, "data": []}

        points = [
            {"x": float(a), "y": float(b)}
            for a, b in zip(frame["__x"], frame["__y"])
        ]
        return {
            **base,
            "x_key": "x",
            "y_key": "y",
            "series_data": [{"name": f"{x} vs {y}", "points": points}],
            "data": [],
        }

    if chart_type == "box":
        if not y or y not in data.columns:
            raise ValueError("Box plots need a numeric Y column.")
        frame = data.copy()
        frame["__y"] = pd.to_numeric(frame[y], errors="coerce")
        frame = frame.dropna(subset=["__y"])
        if frame.empty:
            raise ValueError("No numeric values available for the selected column.")

        if x and x in frame.columns:
            frame["__g"] = frame[x].astype(str)
            groups = frame["__g"].value_counts().head(top_n).index.tolist()
            grouped = [(g, frame[frame["__g"] == g]["__y"]) for g in groups]
        else:
            grouped = [(y, frame["__y"])]

        rows = []
        for label, values in grouped:
            q1, median, q3 = (
                float(values.quantile(0.25)),
                float(values.median()),
                float(values.quantile(0.75)),
            )
            iqr = q3 - q1
            lo_bound = q1 - 1.5 * iqr
            hi_bound = q3 + 1.5 * iqr
            within = values[(values >= lo_bound) & (values <= hi_bound)]
            rows.append(
                {
                    "group": str(label),
                    "min": float(within.min()) if not within.empty else q1,
                    "q1": q1,
                    "median": median,
                    "q3": q3,
                    "max": float(within.max()) if not within.empty else q3,
                    "n": int(values.count()),
                }
            )
        return {**base, "x_key": "group", "y_key": "median", "data": rows}

    raise ValueError(f"Unsupported chart type: {chart_type}")


def correlation_matrix(
    df: pd.DataFrame, columns: List[str], method: str = "pearson"
) -> Dict[str, Any]:
    cols = [c for c in columns if c in df.columns]
    if len(cols) < 2:
        raise ValueError("Select at least two numeric columns.")
    numeric = df[cols].apply(pd.to_numeric, errors="coerce")
    numeric = numeric.dropna(how="all", axis=1)
    if numeric.shape[1] < 2:
        raise ValueError("Fewer than two numeric columns remain after cleaning.")
    corr = numeric.corr(method=method if method in {"pearson", "spearman", "kendall"} else "pearson")
    corr = corr.fillna(0.0)
    matrix = [
        [round(float(corr.iloc[i, j]), 4) for j in range(len(corr.columns))]
        for i in range(len(corr.index))
    ]
    pairs = []
    for i in range(len(corr.columns)):
        for j in range(i + 1, len(corr.columns)):
            pairs.append(
                {
                    "a": str(corr.columns[i]),
                    "b": str(corr.columns[j]),
                    "r": round(float(corr.iloc[i, j]), 4),
                    "n": int(numeric[[corr.columns[i], corr.columns[j]]].dropna().shape[0]),
                }
            )
    pairs.sort(key=lambda p: abs(p["r"]), reverse=True)
    return {
        "columns": [str(c) for c in corr.columns],
        "matrix": matrix,
        "top_pairs": pairs[:8],
        "method": method,
    }


def describe_columns(df: pd.DataFrame, columns: List[str]) -> List[Dict[str, Any]]:
    out = []
    for col in columns:
        if col not in df.columns:
            continue
        s = df[col]
        entry: Dict[str, Any] = {
            "column": str(col),
            "dtype": str(s.dtype),
            "count": int(s.notna().sum()),
            "missing": int(s.isna().sum()),
            "unique": int(s.astype(str).nunique(dropna=True)),
        }
        if pd.api.types.is_numeric_dtype(s):
            clean = pd.to_numeric(s, errors="coerce").dropna()
            if not clean.empty:
                entry.update(
                    {
                        "mean": round(float(clean.mean()), 4),
                        "median": round(float(clean.median()), 4),
                        "std": round(float(clean.std(ddof=0)), 4),
                        "min": round(float(clean.min()), 4),
                        "q1": round(float(clean.quantile(0.25)), 4),
                        "q3": round(float(clean.quantile(0.75)), 4),
                        "max": round(float(clean.max()), 4),
                    }
                )
        else:
            top = s.astype(str).value_counts().head(3)
            entry["top_values"] = [
                {"value": str(k), "count": int(v)} for k, v in top.items()
            ]
        out.append(entry)
    return out