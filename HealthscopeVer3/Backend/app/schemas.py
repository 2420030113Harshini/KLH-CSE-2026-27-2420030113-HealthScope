"""Pydantic request/response schemas."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DatasetOut(BaseModel):
    id: str
    name: str
    source: str = ""
    description: str = ""
    original_filename: str = ""
    rows: int
    columns: int
    size_bytes: int
    is_demo: bool
    parent_id: Optional[str] = None
    created_at: str
    cleaning_log: List[Dict[str, Any]] = Field(default_factory=list)
    column_names: List[str] = Field(default_factory=list)
    numeric_columns: List[str] = Field(default_factory=list)
    categorical_columns: List[str] = Field(default_factory=list)
    datetime_columns: List[str] = Field(default_factory=list)


class FilterSpec(BaseModel):
    column: str
    op: str = "eq"
    value: Any = None


class ChartSpec(BaseModel):
    chart_type: str = "histogram"
    x: Optional[str] = None
    y: Optional[str] = None
    group_by: Optional[str] = None
    bins: int = 20
    agg: str = "mean"
    top_n: int = 15
    filters: List[FilterSpec] = Field(default_factory=list)


class CorrelationSpec(BaseModel):
    columns: List[str] = Field(default_factory=list)
    method: str = "pearson"
    filters: List[FilterSpec] = Field(default_factory=list)


class CleaningOperation(BaseModel):
    operation: str
    column: Optional[str] = None
    columns: Optional[List[str]] = None
    strategy: Optional[str] = None
    value: Optional[Any] = None
    to: Optional[str] = None
    how: Optional[str] = None
    method: Optional[str] = None


class CleanRequest(BaseModel):
    name: Optional[str] = None
    operations: List[CleaningOperation] = Field(default_factory=list)


class TrainRequest(BaseModel):
    dataset_id: str
    target: str
    features: List[str] = Field(default_factory=list)
    task: Optional[str] = None  # auto-detected when omitted
    model: str = "random_forest"
    test_size: float = 0.25
    random_state: int = 42
    stratify: bool = True
    filters: List[FilterSpec] = Field(default_factory=list)
    save: bool = True
    name: Optional[str] = None


class RiskRequest(BaseModel):
    dataset_id: str
    variable: str
    method: str = "rule_based"  # rule_based | model_based
    low_threshold: Optional[float] = None
    high_threshold: Optional[float] = None
    group_by: Optional[str] = None
    model: str = "random_forest"
    features: List[str] = Field(default_factory=list)
    random_state: int = 42
    test_size: float = 0.25
    filters: List[FilterSpec] = Field(default_factory=list)