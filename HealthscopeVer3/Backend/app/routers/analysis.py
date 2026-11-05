"""Data quality, cleaning, charts, correlation and the overview payload."""
from __future__ import annotations

import json
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Activity, Dataset
from ..schemas import ChartSpec, CleanRequest, CorrelationSpec
from ..services import eda
from ..services.quality import apply_cleaning, quality_report
from ..services.storage import column_profile, jsonable, load_dataframe, save_dataframe

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _load(dataset_id: str, db: Session) -> pd.DataFrame:
    if not db.get(Dataset, dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    try:
        return load_dataframe(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc


@router.get("/{dataset_id}/quality")
def quality(dataset_id: str, db: Session = Depends(get_db)) -> dict:
    df = _load(dataset_id, db)
    return jsonable(quality_report(df))


@router.post("/{dataset_id}/clean")
def clean(dataset_id: str, payload: CleanRequest, db: Session = Depends(get_db)) -> dict:
    source = db.get(Dataset, dataset_id)
    if not source:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    if not payload.operations:
        raise HTTPException(status_code=400, detail="Provide at least one cleaning operation.")

    df = load_dataframe(dataset_id)
    before = quality_report(df)
    cleaned, log = apply_cleaning(df, [op.model_dump() for op in payload.operations])
    after = quality_report(cleaned)

    if cleaned.empty:
        raise HTTPException(
            status_code=400,
            detail="The configured operations removed every row. Adjust the operations and retry.",
        )

    new_id = uuid.uuid4().hex
    size = save_dataframe(new_id, cleaned)
    profile = column_profile(cleaned)

    row = Dataset(
        id=new_id,
        name=payload.name or f"{source.name} (cleaned)",
        source=source.source,
        description=f"Derived from '{source.name}' via the Data Quality Lab.",
        original_filename=source.original_filename,
        rows=int(len(cleaned)),
        columns=int(len(cleaned.columns)),
        size_bytes=int(size),
        is_demo=False,
        parent_id=source.id,
        cleaning_log=json.dumps(jsonable(log)),
    )
    db.add(row)
    db.add(
        Activity(
            kind="cleaning",
            message=f"Created '{row.name}' with {len(log)} cleaning operation(s).",
            dataset_id=new_id,
        )
    )
    db.commit()
    db.refresh(row)

    return jsonable(
        {
            "dataset": {
                "id": row.id,
                "name": row.name,
                "rows": row.rows,
                "columns": row.columns,
                "size_bytes": row.size_bytes,
                "parent_id": row.parent_id,
                "created_at": row.created_at.isoformat(),
                **profile,
            },
            "log": log,
            "before": {
                "rows": before["rows"],
                "missing_pct": before["missing_pct"],
                "duplicate_rows": before["duplicate_rows"],
                "quality_score": before["quality_score"],
            },
            "after": {
                "rows": after["rows"],
                "missing_pct": after["missing_pct"],
                "duplicate_rows": after["duplicate_rows"],
                "quality_score": after["quality_score"],
            },
        }
    )


@router.post("/{dataset_id}/chart")
def chart(dataset_id: str, spec: ChartSpec, db: Session = Depends(get_db)) -> dict:
    df = _load(dataset_id, db)
    try:
        result = eda.compute_chart(df, spec.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return jsonable(result)


@router.post("/{dataset_id}/correlation")
def correlation(dataset_id: str, spec: CorrelationSpec, db: Session = Depends(get_db)) -> dict:
    df = _load(dataset_id, db)
    filtered = eda.apply_filters(df, [f.model_dump() for f in spec.filters])
    if filtered.empty:
        raise HTTPException(status_code=400, detail="No rows match the current filters.")
    try:
        result = eda.correlation_matrix(filtered, spec.columns, spec.method)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return jsonable(result)


@router.post("/{dataset_id}/describe")
def describe(dataset_id: str, columns: list[str] | None = None, db: Session = Depends(get_db)) -> dict:
    df = _load(dataset_id, db)
    cols = columns or list(df.columns)
    return jsonable({"stats": eda.describe_columns(df, cols)})


@router.get("/{dataset_id}/overview")
def overview(dataset_id: str, db: Session = Depends(get_db)) -> dict:
    row = db.get(Dataset, dataset_id)
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    df = load_dataframe(dataset_id)
    profile = column_profile(df)
    report = quality_report(df)

    numeric = profile["numeric_columns"]
    categorical = profile["categorical_columns"]
    datetimes = profile["datetime_columns"]

    trend = None
    time_col = datetimes[0] if datetimes else (
        "year" if "year" in df.columns else None
    )
    if time_col and numeric:
        try:
            trend = eda.compute_chart(
                df,
                {
                    "chart_type": "line",
                    "x": time_col,
                    "y": numeric[0],
                    "group_by": None,
                    "filters": [],
                },
            )
            trend["y_label"] = numeric[0]
        except Exception:
            trend = None

    demographic = None
    group_col = next(
        (c for c in ["region", "country", "age_group", "sex"] if c in categorical),
        categorical[0] if categorical else None,
    )
    if group_col and numeric:
        try:
            demographic = eda.compute_chart(
                df,
                {
                    "chart_type": "bar",
                    "x": group_col,
                    "y": numeric[0],
                    "agg": "mean",
                    "top_n": 12,
                    "filters": [],
                },
            )
            demographic["y_label"] = f"Mean {numeric[0]}"
        except Exception:
            demographic = None

    correlation = None
    if len(numeric) >= 2:
        try:
            correlation = eda.correlation_matrix(df, numeric[:8], "pearson")
        except Exception:
            correlation = None

    missing_chart = sorted(
        (
            {"column": c["name"], "missing_pct": c["missing_pct"]}
            for c in report["columns"]
        ),
        key=lambda d: d["missing_pct"],
        reverse=True,
    )[:8]

    return jsonable(
        {
            "dataset": {
                "id": row.id,
                "name": row.name,
                "source": row.source,
                "description": row.description,
                "rows": row.rows,
                "columns": row.columns,
                "is_demo": row.is_demo,
                "created_at": row.created_at.isoformat() if row.created_at else "",
            },
            "kpis": {
                "total_records": report["rows"],
                "total_columns": report["num_columns"],
                "missing_pct": report["missing_pct"],
                "indicators": len(numeric),
                "duplicate_rows": report["duplicate_rows"],
                "quality_score": report["quality_score"],
                "categorical_columns": len(categorical),
                "datetime_columns": len(datetimes),
            },
            "quality": {
                "score": report["quality_score"],
                "warnings": report["warnings"],
                "top_missing": missing_chart,
            },
            "trend": trend,
            "demographic": demographic,
            "correlation": correlation,
        }
    )