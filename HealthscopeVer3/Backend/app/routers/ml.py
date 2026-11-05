"""Model Laboratory and public-health risk assessment endpoints."""
from __future__ import annotations

import json

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Activity, Dataset, Experiment
from ..schemas import RiskRequest, TrainRequest
from ..services import eda
from ..services.modeling import detect_task, recommend_models, train_model
from ..services.storage import column_profile, jsonable, load_dataframe

router = APIRouter(tags=["machine learning"])


def _load(dataset_id: str, db: Session) -> pd.DataFrame:
    if not db.get(Dataset, dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    try:
        return load_dataframe(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc


@router.get("/models/options/{dataset_id}")
def options(dataset_id: str, db: Session = Depends(get_db)) -> dict:
    df = _load(dataset_id, db)
    profile = column_profile(df)
    targets = []
    for col in df.columns:
        task = detect_task(df[col]) if df[col].notna().any() else "unsupported"
        targets.append(
            {
                "column": str(col),
                "task": task,
                "unique": int(df[col].astype(str).nunique(dropna=True)),
                "missing": int(df[col].isna().sum()),
            }
        )
    return jsonable(
        {
            "columns": profile,
            "targets": targets,
            "models": {
                "classification": recommend_models("classification"),
                "regression": recommend_models("regression"),
            },
        }
    )


@router.post("/models/train")
def train(payload: TrainRequest, db: Session = Depends(get_db)) -> dict:
    df = _load(payload.dataset_id, db)
    config = payload.model_dump()
    try:
        result = train_model(df, config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=500, detail=f"Training failed: {exc}"
        ) from exc

    experiment_id = None
    if payload.save:
        row = Experiment(
            name=payload.name or f"{result['model']} → {result['target']}",
            dataset_id=payload.dataset_id,
            task=result["task"],
            target=result["target"],
            model=result["model"],
            config=json.dumps(jsonable(config)),
            metrics=json.dumps(jsonable(result["metrics"])),
        )
        db.add(row)
        db.add(
            Activity(
                kind="model",
                message=(
                    f"Trained {result['model']} on '{result['target']}' "
                    f"({result['task']}, n={result['n_train'] + result['n_test']})."
                ),
                dataset_id=payload.dataset_id,
            )
        )
        db.commit()
        db.refresh(row)
        experiment_id = row.id

    result["experiment_id"] = experiment_id
    return jsonable(result)


@router.post("/models/compare")
def compare(payload: TrainRequest, db: Session = Depends(get_db)) -> dict:
    df = _load(payload.dataset_id, db)
    base = payload.model_dump()
    base["save"] = False
    task = base.get("task")
    if not task:
        if payload.target in df.columns:
            task = detect_task(df[payload.target])
        else:
            raise HTTPException(status_code=400, detail="Invalid target variable.")
    base["task"] = task

    candidates = [m["id"] for m in recommend_models(task)]
    results, errors = [], []
    for model in candidates:
        cfg = dict(base, model=model)
        try:
            out = train_model(df, cfg)
            results.append(
                {
                    "model": model,
                    "metrics": out["metrics"],
                    "warnings": out.get("warnings", []),
                }
            )
        except Exception as exc:
            errors.append({"model": model, "error": str(exc)})

    return jsonable({"task": task, "results": results, "errors": errors})


@router.get("/experiments")
def list_experiments(dataset_id: str | None = None, db: Session = Depends(get_db)) -> dict:
    query = db.query(Experiment)
    if dataset_id:
        query = query.filter(Experiment.dataset_id == dataset_id)
    rows = query.order_by(Experiment.created_at.desc()).limit(50).all()
    return jsonable(
        {
            "items": [
                {
                    "id": r.id,
                    "name": r.name,
                    "dataset_id": r.dataset_id,
                    "task": r.task,
                    "target": r.target,
                    "model": r.model,
                    "config": json.loads(r.config or "{}"),
                    "metrics": json.loads(r.metrics or "{}"),
                    "created_at": r.created_at.isoformat() if r.created_at else "",
                }
                for r in rows
            ]
        }
    )


@router.delete("/experiments/{experiment_id}")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)) -> dict:
    row = db.get(Experiment, experiment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    db.delete(row)
    db.commit()
    return {"deleted": experiment_id}


@router.post("/risk/analyze")
def risk_analyze(payload: RiskRequest, db: Session = Depends(get_db)) -> dict:
    df = _load(payload.dataset_id, db)
    if payload.variable not in df.columns:
        raise HTTPException(status_code=400, detail="Selected variable is not in the dataset.")

    data = eda.apply_filters(df, [f.model_dump() for f in payload.filters])
    if data.empty:
        raise HTTPException(status_code=400, detail="No rows match the current filters.")

    notes = [
        "HealthScope performs population-level analysis for research and education only.",
        "Categories reflect the thresholds YOU choose — they are not clinically validated.",
        "This is not a diagnostic tool and must not be used for individual medical decisions.",
    ]

    result: dict = {
        "method": payload.method,
        "variable": payload.variable,
        "n": int(len(data)),
        "notes": notes,
    }

    if payload.method == "rule_based":
        series = pd.to_numeric(data[payload.variable], errors="coerce").dropna()
        if series.empty:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Rule-based categorisation requires a numeric variable. "
                    f"'{payload.variable}' has no usable numeric values."
                ),
            )
        low_t = payload.low_threshold if payload.low_threshold is not None else float(
            series.quantile(1 / 3)
        )
        high_t = payload.high_threshold if payload.high_threshold is not None else float(
            series.quantile(2 / 3)
        )
        if low_t >= high_t:
            raise HTTPException(
                status_code=400,
                detail="The low threshold must be smaller than the high threshold.",
            )

        def categorise(v: float) -> str:
            if v < low_t:
                return "Low"
            if v < high_t:
                return "Moderate"
            return "High"

        categories = series.apply(categorise)
        counts = categories.value_counts()
        distribution = [
            {"category": c, "count": int(counts.get(c, 0))}
            for c in ["Low", "Moderate", "High"]
        ]

        stats = []
        for cat in ["Low", "Moderate", "High"]:
            subset = series[categories == cat]
            stats.append(
                {
                    "category": cat,
                    "n": int(subset.count()),
                    "mean": round(float(subset.mean()), 4) if not subset.empty else None,
                    "min": round(float(subset.min()), 4) if not subset.empty else None,
                    "max": round(float(subset.max()), 4) if not subset.empty else None,
                }
            )

        result.update(
            {
                "thresholds": {"low": round(low_t, 4), "high": round(high_t, 4)},
                "rule": (
                    f"Low < {low_t:.4g} ≤ Moderate < {high_t:.4g} ≤ High"
                ),
                "distribution": distribution,
                "stats": stats,
                "by_group": _group_breakdown(data, payload.variable, categories, payload.group_by),
            }
        )

        if payload.features:
            try:
                cfg = {
                    "dataset_id": payload.dataset_id,
                    "target": payload.variable,
                    "features": payload.features,
                    "task": None,
                    "model": payload.model,
                    "test_size": payload.test_size,
                    "random_state": payload.random_state,
                    "stratify": True,
                    "filters": [],
                }
                model_out = train_model(data, cfg)
                result["model_validation"] = {
                    "model": model_out["model"],
                    "task": model_out["task"],
                    "metrics": model_out["metrics"],
                    "confusion_matrix": model_out.get("confusion_matrix"),
                    "feature_importance": model_out.get("feature_importance", [])[:12],
                    "warnings": model_out.get("warnings", []),
                }
            except Exception as exc:
                result["model_validation"] = {"error": str(exc)}
        return jsonable(result)

    # model_based ------------------------------------------------------------
    if not payload.features:
        raise HTTPException(
            status_code=400,
            detail="Model-based risk assessment requires at least one feature column.",
        )
    series = pd.to_numeric(data[payload.variable], errors="coerce")
    valid = series.dropna()
    if valid.empty:
        raise HTTPException(
            status_code=400, detail="The selected variable has no numeric values."
        )

    low_t = payload.low_threshold if payload.low_threshold is not None else float(
        valid.quantile(1 / 3)
    )
    high_t = payload.high_threshold if payload.high_threshold is not None else float(
        valid.quantile(2 / 3)
    )
    if low_t >= high_t:
        raise HTTPException(
            status_code=400, detail="The low threshold must be smaller than the high threshold."
        )

    working = data.copy()
    working["__risk_label"] = pd.cut(
        pd.to_numeric(working[payload.variable], errors="coerce"),
        bins=[-float("inf"), low_t, high_t, float("inf")],
        labels=["Low", "Moderate", "High"],
    )
    working = working.dropna(subset=["__risk_label"])

    cfg = {
        "dataset_id": payload.dataset_id,
        "target": "__risk_label",
        "features": payload.features,
        "task": "classification",
        "model": payload.model,
        "test_size": payload.test_size,
        "random_state": payload.random_state,
        "stratify": True,
        "filters": [],
    }
    try:
        model_out = train_model(working, cfg)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    counts = working["__risk_label"].astype(str).value_counts()
    result.update(
        {
            "thresholds": {"low": round(low_t, 4), "high": round(high_t, 4)},
            "rule": (
                "Derived labels: "
                f"Low < {low_t:.4g} ≤ Moderate < {high_t:.4g} ≤ High"
            ),
            "distribution": [
                {"category": c, "count": int(counts.get(c, 0))}
                for c in ["Low", "Moderate", "High"]
            ],
            "model_validation": {
                "model": model_out["model"],
                "task": model_out["task"],
                "metrics": model_out["metrics"],
                "confusion_matrix": model_out.get("confusion_matrix"),
                "feature_importance": model_out.get("feature_importance", [])[:12],
                "warnings": model_out.get("warnings", []),
            },
            "stats": [],
            "by_group": _group_breakdown(
                working, payload.variable, working["__risk_label"].astype(str), payload.group_by
            ),
        }
    )
    return jsonable(result)


def _group_breakdown(
    data: pd.DataFrame, variable: str, categories: pd.Series, group_by: str | None
) -> dict | None:
    if not group_by or group_by not in data.columns:
        return None
    frame = pd.DataFrame(
        {
            "group": data.loc[categories.index, group_by].astype(str),
            "category": categories.astype(str),
        }
    )
    top_groups = frame["group"].value_counts().head(10).index.tolist()
    frame = frame[frame["group"].isin(top_groups)]
    pivot = frame.groupby(["group", "category"]).size().unstack(fill_value=0)
    rows = []
    for group in pivot.index:
        entry = {"group": group}
        for cat in ["Low", "Moderate", "High"]:
            entry[cat] = int(pivot.loc[group, cat]) if cat in pivot.columns else 0
        rows.append(entry)
    return {"group_by": group_by, "data": rows}