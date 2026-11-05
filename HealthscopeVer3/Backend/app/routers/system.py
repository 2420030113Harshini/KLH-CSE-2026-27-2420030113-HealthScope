"""Health check, dataset catalogue and activity feed."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Activity
from ..services.storage import jsonable

router = APIRouter(tags=["system"])


CATALOGUE = [
    {
        "name": "WHO Global Health Observatory",
        "description": "Country-level indicators on mortality, morbidity, "
        "risk factors and health systems.",
        "coverage": "Global (194+ member states)",
        "indicators": "Life expectancy, mortality, immunisation, risk factors",
        "date_range": "2000 – present",
        "source_url": "https://www.who.int/data/gho",
        "access": "Manual CSV/XLSX download",
    },
    {
        "name": "WHO Global Health Estimates",
        "description": "Cause-specific mortality and disability-adjusted life years.",
        "coverage": "Global by region, age and sex",
        "indicators": "DALYs, causes of death, years of life lost",
        "date_range": "2000 – 2021",
        "source_url": "https://www.who.int/data/global-health-estimates",
        "access": "Manual CSV/XLSX download",
    },
    {
        "name": "WHO Health Inequality Data Repository",
        "description": "Disaggregated health indicators by education, wealth, "
        "sex and place of residence.",
        "coverage": "Global with inequality dimensions",
        "indicators": "Reproductive health, child health, HIV, immunisation",
        "date_range": "1990 – present",
        "source_url": "https://www.who.int/data/inequality-monitor/data",
        "access": "Manual CSV download",
    },
    {
        "name": "CDC Behavioral Risk Factor Surveillance System (BRFSS)",
        "description": "State-level telephone survey on health risk behaviours.",
        "coverage": "United States, state and territory level",
        "indicators": "Smoking, BMI, physical activity, chronic conditions",
        "date_range": "1984 – present",
        "source_url": "https://www.cdc.gov/brfss/",
        "access": "Manual SAS/CSV export",
    },
    {
        "name": "CDC National Health and Nutrition Examination Survey (NHANES)",
        "description": "Combined interview and physical examination survey.",
        "coverage": "United States, national sample",
        "indicators": "Nutrition, biomarkers, chronic disease, anthropometry",
        "date_range": "1999 – present (2-year cycles)",
        "source_url": "https://www.cdc.gov/nchs/nhanes/",
        "access": "Manual XPT/CSV download",
    },
    {
        "name": "UCI Diabetes 130-US Hospitals (1999-2008)",
        "description": "Hospital encounters with diabetes and readmission outcome.",
        "coverage": "United States, 130 hospitals",
        "indicators": "Demographics, lab results, medications, readmission",
        "date_range": "1999 – 2008",
        "source_url": "https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008",
        "access": "Manual CSV download",
    },
    {
        "name": "India Open Government Data — Health",
        "description": "National and state health statistics published by data.gov.in.",
        "coverage": "India, national and state level",
        "indicators": "Facility counts, immunisation, maternal and child health",
        "date_range": "Varies by resource",
        "source_url": "https://data.gov.in/",
        "access": "Manual CSV/API per resource",
    },
    {
        "name": "WHO Environmental Health Indicators",
        "description": "Air quality, water and sanitation, and climate-related health.",
        "coverage": "Global",
        "indicators": "PM2.5, safe water, sanitation, ambient air pollution",
        "date_range": "2000 – present",
        "source_url": "https://www.who.int/data/gho/data/themes/environment-and-health",
        "access": "Manual CSV download",
    },
]


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "HealthScope API", "version": "1.0.0"}


@router.get("/catalogue")
def catalogue() -> dict:
    return {
        "note": (
            "HealthScope does not download these datasets automatically. "
            "Export the required table from the source and upload it as CSV/XLSX. "
            "Incompatible datasets are never merged automatically."
        ),
        "datasets": CATALOGUE,
    }


@router.get("/activity")
def activity(limit: int = 20, db: Session = Depends(get_db)) -> dict:
    rows = (
        db.query(Activity)
        .order_by(Activity.created_at.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )
    return {
        "items": [
            {
                "id": r.id,
                "kind": r.kind,
                "message": r.message,
                "dataset_id": r.dataset_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


@router.delete("/activity")
def clear_activity(db: Session = Depends(get_db)) -> dict:
    deleted = db.query(Activity).delete()
    db.commit()
    return jsonable({"deleted": deleted})