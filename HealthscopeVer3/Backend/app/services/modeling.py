"""Machine-learning training, evaluation and population risk categorisation."""
from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from .eda import apply_filters

CLASSIFICATION_MODELS = {
    "logistic_regression": "Logistic Regression",
    "decision_tree": "Decision Tree",
    "random_forest": "Random Forest",
    "knn": "K-Nearest Neighbors",
}
REGRESSION_MODELS = {
    "linear_regression": "Linear Regression",
    "decision_tree": "Decision Tree",
    "random_forest": "Random Forest",
    "knn": "K-Nearest Neighbors",
}


def detect_task(series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(series):
        unique = series.dropna().nunique()
        if unique <= 10 and float(unique) / max(len(series), 1) < 0.05:
            return "classification"
        return "regression"
    return "classification"


def recommend_models(task: str) -> List[Dict[str, str]]:
    table = CLASSIFICATION_MODELS if task == "classification" else REGRESSION_MODELS
    return [{"id": k, "label": v} for k, v in table.items()]


def _build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = [c for c in X.columns if c not in numeric_cols]

    numeric_pipe = Pipeline(
        [("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]
    )
    categorical_pipe = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )

    transformers = []
    if numeric_cols:
        transformers.append(("num", numeric_pipe, numeric_cols))
    if categorical_cols:
        transformers.append(("cat", categorical_pipe, categorical_cols))

    return ColumnTransformer(transformers, remainder="drop")


def _make_estimator(task: str, model: str, random_state: int):
    if task == "classification":
        return {
            "logistic_regression": LogisticRegression(max_iter=2000, random_state=random_state),
            "decision_tree": DecisionTreeClassifier(random_state=random_state, max_depth=8),
            "random_forest": RandomForestClassifier(
                n_estimators=300, random_state=random_state, n_jobs=-1
            ),
            "knn": KNeighborsClassifier(n_neighbors=5),
        }.get(model, RandomForestClassifier(n_estimators=300, random_state=random_state))
    return {
        "linear_regression": LinearRegression(),
        "decision_tree": DecisionTreeRegressor(random_state=random_state, max_depth=8),
        "random_forest": RandomForestRegressor(
            n_estimators=300, random_state=random_state, n_jobs=-1
        ),
        "knn": KNeighborsRegressor(n_neighbors=5),
    }.get(model, RandomForestRegressor(n_estimators=300, random_state=random_state))


def _feature_names(preprocessor: ColumnTransformer, X: pd.DataFrame) -> List[str]:
    try:
        return [str(n) for n in preprocessor.get_feature_names_out()]
    except Exception:
        return [str(c) for c in X.columns]


def _extract_importance(estimator, names: List[str]) -> List[Dict[str, Any]]:
    values = None
    if hasattr(estimator, "feature_importances_"):
        values = np.asarray(estimator.feature_importances_, dtype=float)
    elif hasattr(estimator, "coef_"):
        coef = np.asarray(estimator.coef_, dtype=float)
        values = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)

    if values is None or len(values) != len(names):
        return []

    pairs = sorted(
        ({"feature": names[i], "importance": float(values[i])} for i in range(len(names))),
        key=lambda d: d["importance"],
        reverse=True,
    )
    return pairs[:25]


def train_model(df: pd.DataFrame, config: Dict[str, Any]) -> Dict[str, Any]:
    target = config.get("target")
    if not target or target not in df.columns:
        raise ValueError("Select a valid target variable.")

    data = apply_filters(df, config.get("filters"))
    data = data.dropna(subset=[target])
    if len(data) < 30:
        raise ValueError(
            f"Only {len(data)} usable rows remain after removing missing targets. "
            "At least 30 rows are required for a meaningful evaluation."
        )

    features = [c for c in (config.get("features") or []) if c in df.columns and c != target]
    if not features:
        raise ValueError("Select at least one feature column.")

    X = data[features]
    y = data[target]

    task = config.get("task") or detect_task(y)
    if task == "classification":
        y = y.astype(str)
        if y.nunique() < 2:
            raise ValueError("The target has fewer than two distinct classes.")
        if y.nunique() > 25:
            raise ValueError(
                "The target has too many distinct values for classification "
                f"({y.nunique()}). Choose a numeric regression target instead."
            )

    test_size = float(config.get("test_size") or 0.25)
    test_size = min(max(test_size, 0.1), 0.5)
    random_state = int(config.get("random_state") or 42)

    stratify = y if (task == "classification" and config.get("stratify", True)
                     and y.value_counts().min() >= 2) else None

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=stratify
    )

    preprocessor = _build_preprocessor(X_train)
    estimator = _make_estimator(task, config.get("model", "random_forest"), random_state)

    pipeline = Pipeline([("prep", preprocessor), ("model", estimator)])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    names = _feature_names(preprocessor, X)
    fitted = pipeline.named_steps["model"]

    result: Dict[str, Any] = {
        "task": task,
        "model": config.get("model", "random_forest"),
        "target": target,
        "features": features,
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "random_state": random_state,
        "test_size": test_size,
        "class_distribution": (
            y.value_counts().to_dict() if task == "classification" else None
        ),
        "warnings": [],
    }

    if task == "classification":
        labels = sorted(y.unique().tolist())
        result["labels"] = labels
        result["metrics"] = {
            "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
            "precision": round(
                float(precision_score(y_test, y_pred, average="weighted", zero_division=0)), 4
            ),
            "recall": round(
                float(recall_score(y_test, y_pred, average="weighted", zero_division=0)), 4
            ),
            "f1": round(
                float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4
            ),
        }
        cm = confusion_matrix(y_test, y_pred, labels=labels)
        result["confusion_matrix"] = {
            "labels": labels,
            "matrix": [[int(v) for v in row] for row in cm],
        }
        try:
            if len(labels) == 2 and hasattr(pipeline, "predict_proba"):
                proba = pipeline.predict_proba(X_test)[:, 1]
                binary = (y_test == labels[1]).astype(int)
                result["metrics"]["roc_auc"] = round(float(roc_auc_score(binary, proba)), 4)
        except Exception:
            pass
        if min(result["class_distribution"].values()) < 10:
            result["warnings"].append(
                "At least one class has fewer than 10 samples — metrics may be unstable."
            )
    else:
        y_test_num = pd.to_numeric(y_test, errors="coerce")
        y_pred_num = pd.to_numeric(pd.Series(y_pred), errors="coerce")
        mask = y_test_num.notna() & y_pred_num.notna()
        mae = mean_absolute_error(y_test_num[mask], y_pred_num[mask])
        rmse = float(np.sqrt(mean_squared_error(y_test_num[mask], y_pred_num[mask])))
        r2 = r2_score(y_test_num[mask], y_pred_num[mask])
        result["metrics"] = {
            "mae": round(float(mae), 4),
            "rmse": round(rmse, 4),
            "r2": round(float(r2), 4),
        }
        result["scatter"] = [
            {"actual": float(a), "predicted": float(p)}
            for a, p in zip(y_test_num[mask][:500], y_pred_num[mask][:500])
        ]

    result["feature_importance"] = _extract_importance(fitted, names)

    if len(data) < 200:
        result["warnings"].append(
            f"Dataset slice contains only {len(data)} rows — treat results as exploratory."
        )

    return result