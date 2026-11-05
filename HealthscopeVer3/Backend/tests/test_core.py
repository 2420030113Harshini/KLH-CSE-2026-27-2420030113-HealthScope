"""Core backend tests: data processing, ML evaluation, API endpoints."""
from __future__ import annotations

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.demo_data import build_demo_dataframe
from app.main import app
from app.services.eda import compute_chart, correlation_matrix
from app.services.modeling import detect_task, train_model
from app.services.quality import apply_cleaning, quality_report

client = TestClient(app)


@pytest.fixture(scope="module")
def demo_df() -> pd.DataFrame:
    return build_demo_dataframe()


def test_demo_data_shape(demo_df):
    assert len(demo_df) == 12 * 9 * 3 * 2
    assert "diabetes_prevalence_pct" in demo_df.columns


def test_quality_report(demo_df):
    report = quality_report(demo_df)
    assert report["rows"] == len(demo_df)
    assert 0 <= report["quality_score"] <= 100
    assert report["missing_cells"] == 0


def test_cleaning_does_not_mutate_original(demo_df):
    original_cols = list(demo_df.columns)
    cleaned, log = apply_cleaning(demo_df, [{"operation": "drop_columns", "columns": ["sex"]}])
    assert list(demo_df.columns) == original_cols
    assert "sex" not in cleaned.columns
    assert log[0]["status"] == "applied"


def test_chart_histogram(demo_df):
    out = compute_chart(
        demo_df, {"chart_type": "histogram", "x": "mean_bmi", "bins": 10, "filters": []}
    )
    assert len(out["data"]) == 10
    assert sum(r["value"] for r in out["data"]) == len(demo_df)


def test_chart_rejects_bad_column(demo_df):
    with pytest.raises(ValueError):
        compute_chart(demo_df, {"chart_type": "histogram", "x": "nope", "filters": []})


def test_correlation(demo_df):
    out = correlation_matrix(demo_df, ["mean_bmi", "diabetes_prevalence_pct"], "pearson")
    assert out["matrix"][0][0] == pytest.approx(1.0)


def test_detect_task(demo_df):
    assert detect_task(demo_df["diabetes_prevalence_pct"]) == "regression"
    assert detect_task(demo_df["sex"]) == "classification"


def test_train_classification(demo_df):
    result = train_model(
        demo_df,
        {
            "target": "sex",
            "features": ["mean_bmi", "smoking_prevalence_pct", "age_group"],
            "task": "classification",
            "model": "random_forest",
            "test_size": 0.25,
            "random_state": 42,
            "filters": [],
        },
    )
    assert 0 <= result["metrics"]["accuracy"] <= 1
    assert result["confusion_matrix"]["labels"] == ["Female", "Male"]


def test_train_regression(demo_df):
    result = train_model(
        demo_df,
        {
            "target": "life_expectancy_years",
            "features": ["gdp_per_capita_usd", "clean_water_access_pct", "pm25_ug_m3"],
            "task": "regression",
            "model": "linear_regression",
            "test_size": 0.25,
            "random_state": 42,
            "filters": [],
        },
    )
    assert "rmse" in result["metrics"]
    assert result["metrics"]["r2"] <= 1.0


def test_train_rejects_missing_target(demo_df):
    with pytest.raises(ValueError):
        train_model(
            demo_df,
            {"target": "does_not_exist", "features": ["mean_bmi"], "filters": []},
        )


def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_api_demo_and_overview_flow():
    created = client.post("/api/datasets/demo")
    assert created.status_code == 200
    dataset_id = created.json()["id"]

    overview = client.get(f"/api/analysis/{dataset_id}/overview")
    assert overview.status_code == 200
    assert overview.json()["kpis"]["total_records"] > 0

    preview = client.get(f"/api/datasets/{dataset_id}/preview?page=1&page_size=5")
    assert preview.status_code == 200
    assert len(preview.json()["rows"]) == 5

    chart = client.post(
        f"/api/analysis/{dataset_id}/chart",
        json={"chart_type": "bar", "x": "region", "y": "life_expectancy_years"},
    )
    assert chart.status_code == 200

    train = client.post(
        "/api/models/train",
        json={
            "dataset_id": dataset_id,
            "target": "sex",
            "features": ["mean_bmi", "smoking_prevalence_pct"],
            "task": "classification",
            "model": "decision_tree",
            "save": False,
        },
    )
    assert train.status_code == 200
    assert "accuracy" in train.json()["metrics"]

    assert client.delete(f"/api/datasets/{dataset_id}").status_code == 200


def test_api_rejects_unknown_dataset():
    assert client.get("/api/datasets/does-not-exist").status_code == 404