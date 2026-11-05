"""HealthScope FastAPI application entry point."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import CORS_ORIGINS
from .database import init_db
from .routers import analysis, datasets, ml, system

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("healthscope")

app = FastAPI(
    title="HealthScope API",
    version="1.0.0",
    description=(
        "Public-health analytics, data quality, exploratory analysis, "
        "machine learning and population-level risk categorisation. "
        "Research and educational decision support only — not a medical device."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(ml.router, prefix="/api")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    logger.info("HealthScope API ready. Storage initialised.")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": (
                "An unexpected server error occurred. The request was not completed. "
                f"({type(exc).__name__})"
            )
        },
    )


@app.get("/")
def root() -> dict:
    return {
        "service": "HealthScope API",
        "docs": "/docs",
        "disclaimer": (
            "Population-level research and educational decision support only. "
            "Not for diagnosis, treatment, or individual medical risk assessment."
        ),
    }