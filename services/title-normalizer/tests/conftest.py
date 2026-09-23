import sqlite3
from pathlib import Path

import pytest

from title_normalizer import repository

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_SNAPSHOT = REPO_ROOT / "backend" / "src" / "Backend.Infrastructure" / "Pipeline" / "pipeline-schema.sql"


@pytest.fixture
def pipeline_db(tmp_path: Path) -> sqlite3.Connection:
    """Fresh pipeline.db built from the backend's committed schema snapshot (the contract)."""
    path = tmp_path / "pipeline.db"
    setup = sqlite3.connect(path)
    setup.executescript(SCHEMA_SNAPSHOT.read_text())
    setup.close()
    connection = repository.connect(path)
    yield connection
    connection.close()


def insert_job(
    connection: sqlite3.Connection,
    payload: str,
    account_id: str = "acc-1",
    media_kind: str = "movie",
    status: str = "pending",
    attempts: int = 0,
    started_at: int | None = None,
) -> int:
    cursor = connection.execute(
        "INSERT INTO normalization_jobs (account_id, media_kind, status, payload, item_count, attempts, created_at, started_at) "
        "VALUES (?, ?, ?, ?, 0, ?, 0, ?)",
        (account_id, media_kind, status, payload, attempts, started_at),
    )
    return cursor.lastrowid
