"""Deterministic synthetic demonstration dataset.

This is NOT real epidemiological data. It is generated purely for software
demonstration and must always be labelled as synthetic in the UI.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

COUNTRIES = [
    ("Norway", "Europe", 82000, 6.0),
    ("Germany", "Europe", 51000, 11.0),
    ("India", "South Asia", 2400, 58.0),
    ("Bangladesh", "South Asia", 2700, 62.0),
    ("Nigeria", "Sub-Saharan Africa", 2200, 70.0),
    ("Kenya", "Sub-Saharan Africa", 2100, 55.0),
    ("Brazil", "Latin America", 9000, 44.0),
    ("Mexico", "Latin America", 10000, 48.0),
    ("Japan", "East Asia", 34000, 8.0),
    ("China", "East Asia", 12500, 34.0),
    ("United States", "North America", 70000, 9.0),
    ("Canada", "North America", 52000, 7.0),
]

AGE_GROUPS = ["18-34", "35-54", "55+"]
SEXES = ["Female", "Male"]
YEARS = list(range(2015, 2024))


def build_demo_dataframe(seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []

    for country, region, gdp, base_pm25 in COUNTRIES:
        for year in YEARS:
            year_growth = 1 + 0.012 * (year - 2015)
            for age in AGE_GROUPS:
                age_risk = {"18-34": 0.72, "35-54": 1.0, "55+": 1.45}[age]
                for sex in SEXES:
                    sex_risk = 0.88 if sex == "Female" else 1.12
                    noise = lambda s: float(rng.normal(0, s))

                    clean_water = float(
                        np.clip(
                            62 + (gdp / 1200) + (year - 2015) * 0.6 + noise(3.5), 25, 100
                        )
                    )
                    vaccination = float(
                        np.clip(
                            70 + (gdp / 2200) + (year - 2015) * 0.5 + noise(4.0), 40, 99
                        )
                    )
                    pm25 = float(
                        np.clip(base_pm25 * (1 - 0.02 * (year - 2015)) + noise(3.0), 3, 95)
                    )
                    health_exp = float(
                        np.clip(gdp / 3200 + noise(0.6), 1.2, 18.0)
                    )
                    smoking = float(
                        np.clip(
                            30 * sex_risk - (gdp / 9000) * 4 + noise(4.5), 3, 55
                        )
                    )
                    inactivity = float(
                        np.clip(20 + (gdp / 12000) * 4 + noise(6.0), 6, 60)
                    )
                    bmi = float(
                        np.clip(
                            22 + (gdp / 9000) * 2.4 + 0.8 * (age_risk - 1) * 6 + noise(1.6),
                            16, 40,
                        )
                    )
                    diabetes = float(
                        np.clip(
                            3.0
                            + (bmi - 22) * 0.55
                            + (age_risk - 1) * 5.0
                            + (gdp / 20000) * 1.6
                            + noise(1.1),
                            0.5, 34,
                        )
                    )
                    hypertension = float(
                        np.clip(
                            14 + (age_risk - 1) * 14 + 0.35 * (bmi - 22) + noise(3.2),
                            4, 68,
                        )
                    )
                    under5 = float(
                        np.clip(
                            70 - (gdp / 900)
                            - (clean_water - 60) * 0.55
                            - (vaccination - 70) * 0.35
                            + noise(4.5),
                            1.5, 130,
                        )
                    )
                    life_exp = float(
                        np.clip(
                            56
                            + np.log1p(gdp) * 1.9
                            + (clean_water - 60) * 0.09
                            - (pm25 - 20) * 0.12
                            - (diabetes - 6) * 0.25
                            + noise(1.1),
                            48, 87,
                        )
                    )

                    rows.append(
                        {
                            "country": country,
                            "region": region,
                            "year": year,
                            "age_group": age,
                            "sex": sex,
                            "gdp_per_capita_usd": round(gdp * year_growth, 1),
                            "pm25_ug_m3": round(pm25, 2),
                            "clean_water_access_pct": round(clean_water, 2),
                            "vaccination_coverage_pct": round(vaccination, 2),
                            "health_expenditure_pct_gdp": round(health_exp, 2),
                            "smoking_prevalence_pct": round(smoking, 2),
                            "physical_inactivity_pct": round(inactivity, 2),
                            "mean_bmi": round(bmi, 2),
                            "diabetes_prevalence_pct": round(diabetes, 2),
                            "hypertension_prevalence_pct": round(hypertension, 2),
                            "under5_mortality_per_1000": round(under5, 2),
                            "life_expectancy_years": round(life_exp, 2),
                        }
                    )

    return pd.DataFrame(rows)