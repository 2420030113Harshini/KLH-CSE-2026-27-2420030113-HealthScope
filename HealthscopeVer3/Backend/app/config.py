"""Runtime configuration for the HealthScope backend."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

_storage_env = os.getenv("HEALTHSCOPE_STORAGE", "storage")
STORAGE_DIR = Path(_storage_env)
if not STORAGE_DIR.is_absolute():
    STORAGE_DIR = (BASE_DIR / STORAGE_DIR).resolve()

DATASET_DIR = STORAGE_DIR / "datasets"
DB_PATH = STORAGE_DIR / "healthscope.db"

MAX_UPLOAD_MB = int(os.getenv("HEALTHSCOPE_MAX_UPLOAD_MB", "75"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "HEALTHSCOPE_CORS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173",
    ).split(",")
    if o.strip()
]

for _d in (STORAGE_DIR, DATASET_DIR):
    _d.mkdir(parents=True, exist_ok=True)