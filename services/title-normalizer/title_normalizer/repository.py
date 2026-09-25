"""SQLite access to pipeline.db. Schema is owned by the backend (EF Core); this module only reads/writes rows."""

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from title_normalizer.pipeline import Master

MAX_ERROR_LENGTH = 2000


@dataclass(frozen=True)
class Job:
    id: int
    account_id: str
    media_kind: str
    payload: str
    attempts: int


def connect(path: Path) -> sqlite3.Connection:
    """Autocommit connection; transactions are opened explicitly. Waits up to 30 s on locks held by the backend."""
    connection = sqlite3.connect(path, timeout=30, isolation_level=None)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=30000")
    return connection


def schema_ready(connection: sqlite3.Connection) -> bool:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('normalization_jobs','master_media','media_variants')"
    ).fetchall()
    return len(rows) == 3


def requeue_stale(connection: sqlite3.Connection, now: int, stale_seconds: int, max_attempts: int) -> int:
    """Jobs stuck in `processing` (worker crashed) go back to `pending`, or to `failed` after `max_attempts`."""
    cursor = connection.execute(
        """
        UPDATE normalization_jobs
        SET status = CASE WHEN attempts >= ? THEN 'failed' ELSE 'pending' END,
            error = CASE WHEN attempts >= ? THEN 'Worker stopped while processing.' ELSE error END,
            finished_at = CASE WHEN attempts >= ? THEN ? ELSE finished_at END,
            locked_by = NULL
        WHERE status = 'processing' AND started_at < ?
        """,
        (max_attempts, max_attempts, max_attempts, now, now - stale_seconds),
    )
    return cursor.rowcount


def claim_next(connection: sqlite3.Connection, worker_id: str, now: int) -> Job | None:
    """Atomically moves the oldest pending job to `processing`. Safe with several workers."""
    row = connection.execute(
        """
        UPDATE normalization_jobs
        SET status = 'processing', started_at = ?, attempts = attempts + 1, locked_by = ?
        WHERE id = (SELECT id FROM normalization_jobs WHERE status = 'pending' ORDER BY id LIMIT 1)
        RETURNING id, account_id, media_kind, payload, attempts
        """,
        (now, worker_id),
    ).fetchone()
    return Job(*row) if row else None


def complete(connection: sqlite3.Connection, job: Job, masters: list[Master], now: int) -> None:
    """Replaces the whole library for the job's account + kind with `masters`, then marks the job done."""
    connection.execute("BEGIN IMMEDIATE")
    try:
        scope = (job.account_id, job.media_kind)
        connection.execute("DELETE FROM media_variants WHERE account_id = ? AND media_kind = ?", scope)
        connection.execute("DELETE FROM master_media WHERE account_id = ? AND media_kind = ?", scope)
        connection.executemany(
            """
            INSERT INTO master_media (id, account_id, media_kind, title, normalized_key, year, poster_url, rating,
                                      best_quality, variant_count, added_at, release_key, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    m.id,
                    *scope,
                    m.title,
                    m.normalized_key,
                    m.year,
                    m.poster_url,
                    m.rating,
                    m.best_quality,
                    len(m.variants),
                    m.added_at,
                    m.release_key,
                    now,
                )
                for m in masters
            ],
        )
        connection.executemany(
            """
            INSERT INTO media_variants (account_id, media_kind, stream_id, master_id, raw_title, label, quality, source,
                                        audio_languages, audio_tag, is_hdr, quality_score, category_id, poster_url,
                                        rating, container_extension)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    *scope,
                    v.stream_id,
                    m.id,
                    v.raw_title,
                    v.label,
                    v.quality,
                    v.source,
                    json.dumps(list(v.audio_languages)),
                    v.audio_tag,
                    int(v.is_hdr),
                    v.quality_score,
                    v.category_id,
                    v.poster_url,
                    v.rating,
                    v.container_extension,
                )
                for m in masters
                for v in m.variants
            ],
        )
        # Payload is only needed until processed; clearing it keeps pipeline.db small.
        connection.execute(
            "UPDATE normalization_jobs SET status = 'done', finished_at = ?, error = NULL, payload = '[]', locked_by = NULL WHERE id = ?",
            (now, job.id),
        )
        connection.execute("COMMIT")
    except BaseException:
        connection.execute("ROLLBACK")
        raise


def fail(connection: sqlite3.Connection, job: Job, error: str, now: int, max_attempts: int) -> None:
    """Retries later (`pending`) until `max_attempts`, then `failed`."""
    connection.execute(
        """
        UPDATE normalization_jobs
        SET status = CASE WHEN attempts >= ? THEN 'failed' ELSE 'pending' END,
            error = ?, finished_at = CASE WHEN attempts >= ? THEN ? ELSE NULL END, locked_by = NULL
        WHERE id = ?
        """,
        (max_attempts, error[:MAX_ERROR_LENGTH], max_attempts, now, job.id),
    )
