"""ORM models. No personal or identifiable health information is stored."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from .database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    source = Column(String, default="")
    description = Column(Text, default="")
    original_filename = Column(String, default="")
    rows = Column(Integer, default=0)
    columns = Column(Integer, default=0)
    size_bytes = Column(Integer, default=0)
    is_demo = Column(Boolean, default=False)
    parent_id = Column(String, nullable=True)
    cleaning_log = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String, default="info")
    message = Column(Text, default="")
    dataset_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, default="Experiment")
    dataset_id = Column(String, nullable=False)
    task = Column(String, default="classification")
    target = Column(String, default="")
    model = Column(String, default="")
    config = Column(Text, default="{}")
    metrics = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)