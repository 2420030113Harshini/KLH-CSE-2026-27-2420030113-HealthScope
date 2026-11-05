"""Dataset upload, listing, preview, statistics and download."""
from __future__ import annotations

import io
import json
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..config import MAX_UPLOAD_BYTES, MAX_UPLOAD_MB
from ..database import get_db
from ..demo_data import build_demo_dataframe
from ..models import Activity, Dataset
from ..services.storage import (
    column_profile,
    dataset_path,
    jsonable,
    load_dataframe,
    save_dataframe,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".txt"}


def _log(db: Session, kind: str, message: str, dataset_id: str | None = None) -> None:
    db.add(Activity(kind=kind, message=message, dataset_id=dataset_id))


def _serialize(row: Dataset, df: pd.DataFrame | None = None) -> dict:
    profile = column_profile(df) if df is not None else {
        "column_names": [],
        "numeric_columns": [],
        "categorical_columns": [],
        "datetime_columns": [],
    }
    try:
        cleaning_log = json.loads(row.cleaning_log or "[]")
    except Exception:
        cleaning_log = []
    return jsonable(
        {
            "id": row.id,
            "name": row.name,
            "source": row.source,
            "description": row.description,
            "original_filename": row.original_filename,
            "rows": row.rows,
            "columns": row.columns,
            "size_bytes": row.size_bytes,
            "is_demo": row.is_demo,
            "parent_id": row.parent_id,
            "created_at": row.created_at.isoformat() if row.created_at else "",
            "cleaning_log": cleaning_log,
            **profile,
        }
    )


def _read_upload(file: UploadFile, raw: bytes) -> pd.DataFrame:
    filename = file.filename or ""
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{ext or 'unknown'}'. "
                "Upload a .csv, .xlsx or .xls file."
            ),
        )
    try:
        if ext in {".xlsx", ".xls"}:
            df = pd.read_excel(io.BytesIO(raw))
        else:
            try:
                df = pd.read_csv(io.BytesIO(raw))
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(raw), encoding="latin-1")
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "The file could not be parsed. Check that it is a valid delimited "
                f"text or Excel file and that the header row is present. ({exc})"
            ),
        ) from exc

    if df.empty or len(df.columns) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file contains no data rows.")
    df.columns = [str(c).strip() for c in df.columns]
    return df


@router.get("")
def list_datasets(db: Session = Depends(get_db)) -> dict:
    rows = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    items = []
    for r in rows:
        try:
            df = load_dataframe(r.id)
            items.append(_serialize(r, df))
        except Exception:
            items.append(_serialize(r))
    return {"items": items}


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str, db: Session = Depends(get_db)) -> dict:
    row = db.get(Dataset, dataset_id)
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    try:
        df = load_dataframe(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
    return _serialize(row, df)


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(""),
    source: str = Form(""),
    description: str = Form(""),
    db: Session = Depends(get_db),
) -> dict:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_UPLOAD_MB} MB upload limit.",
        )

    df = _read_upload(file, raw)
    dataset_id = uuid.uuid4().hex
    size = save_dataframe(dataset_id, df)

    row = Dataset(
        id=dataset_id,
        name=name.strip() or (file.filename or "Uploaded dataset"),
        source=source.strip(),
        description=description.strip(),
        original_filename=file.filename or "",
        rows=int(len(df)),
        columns=int(len(df.columns)),
        size_bytes=int(size),
        is_demo=False,
    )
    db.add(row)
    _log(db, "upload", f"Uploaded '{row.name}' ({len(df)} rows).", dataset_id)
    db.commit()
    db.refresh(row)
    return _serialize(row, df)


@router.post("/demo")
def load_demo(db: Session = Depends(get_db)) -> dict:
    df = build_demo_dataframe()
    dataset_id = uuid.uuid4().hex
    size = save_dataframe(dataset_id, df)

    row = Dataset(
        id=dataset_id,
        name="HealthScope Demonstration Dataset (synthetic)",
        source="Generated in-app — NOT real epidemiological data",
        description=(
            "Deterministic synthetic panel of 12 countries × 9 years × 3 age groups × 2 sexes. "
            "Indicators are simulated with plausible relationships for software demonstration only. "
            "Do not cite as evidence."
        ),
        original_filename="healthscope_demo_synthetic.csv",
        rows=int(len(df)),
        columns=int(len(df.columns)),
        size_bytes=int(size),
        is_demo=True,
    )
    db.add(row)
    _log(db, "demo", "Loaded the synthetic demonstration dataset.", dataset_id)
    db.commit()
    db.refresh(row)
    return _serialize(row, df)


@router.get("/{dataset_id}/preview")
def preview(
    dataset_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=200),
    search: str = "",
    sort_by: str = "",
    sort_dir: str = "asc",
    db: Session = Depends(get_db),
) -> dict:
    if not db.get(Dataset, dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    df = load_dataframe(dataset_id)

    if search.strip():
        needle = search.strip().lower()
        mask = df.astype(str).apply(
            lambda col: col.str.lower().str.contains(needle, na=False, regex=False)
        ).any(axis=1)
        df = df[mask]

    if sort_by and sort_by in df.columns:
        df = df.sort_values(by=sort_by, ascending=(sort_dir.lower() != "desc"), kind="mergesort")

    total = int(len(df))
    start = (page - 1) * page_size
    page_df = df.iloc[start : start + page_size]

    return jsonable(
        {
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": max(1, (total + page_size - 1) // page_size),
            "columns": [str(c) for c in df.columns],
            "rows": page_df.to_dict(orient="records"),
        }
    )


@router.get("/{dataset_id}/statistics")
def statistics(dataset_id: str, db: Session = Depends(get_db)) -> dict:
    if not db.get(Dataset, dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    df = load_dataframe(dataset_id)
    from ..services.eda import describe_columns

    return jsonable({"stats": describe_columns(df, list(df.columns))})


@router.get("/{dataset_id}/values/{column}")
def column_values(dataset_id: str, column: str, limit: int = 200) -> dict:
    df = load_dataframe(dataset_id)
    if column not in df.columns:
        raise HTTPException(status_code=404, detail=f"Column '{column}' not found.")
    values = df[column].dropna().astype(str).unique().tolist()
    return {"column": column, "values": values[: max(1, min(limit, 1000))]}


@router.get("/{dataset_id}/download")
def download(dataset_id: str, db: Session = Depends(get_db)) -> StreamingResponse:
    row = db.get(Dataset, dataset_id)
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    path = dataset_path(dataset_id)
    if not path.exists():
        raise HTTPException(status_code=410, detail="Dataset file is missing on disk.")

    payload = path.read_bytes()
    safe = "".join(c if c.isalnum() or c in "-_ " else "_" for c in row.name)[:60]
    return StreamingResponse(
        io.BytesIO(payload),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe or dataset_id}.csv"'},
    )


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)) -> dict:
    row = db.get(Dataset, dataset_id)
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    path = dataset_path(dataset_id)
    if path.exists():
        path.unlink()
    db.delete(row)
    _log(db, "delete", f"Deleted dataset '{row.name}'.")
    db.commit()
    return {"deleted": dataset_id}