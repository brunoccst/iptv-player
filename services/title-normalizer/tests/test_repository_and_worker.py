import json
import sqlite3

from conftest import insert_job

from title_normalizer import repository, worker

PAYLOAD = json.dumps(
    [
        {
            "id": "55",
            "name": "The Movie (2020) 4K",
            "categoryId": "10",
            "posterUrl": "http://img/55.jpg",
            "rating": 7.1,
            "containerExtension": "mkv",
            "releaseDate": None,
        },
        {
            "id": "56",
            "name": "The Movie (2020) CAM",
            "categoryId": "11",
            "posterUrl": None,
            "rating": None,
            "containerExtension": "mp4",
            "releaseDate": None,
        },
        {
            "id": "57",
            "name": "Other Film",
            "categoryId": "10",
            "posterUrl": None,
            "rating": None,
            "containerExtension": "mp4",
            "releaseDate": None,
        },
    ]
)


def job_row(connection: sqlite3.Connection, job_id: int) -> tuple:
    return connection.execute("SELECT status, attempts, error, payload FROM normalization_jobs WHERE id = ?", (job_id,)).fetchone()


def test_schema_ready(pipeline_db):
    assert repository.schema_ready(pipeline_db)


def test_run_once_processes_job_and_writes_masters(pipeline_db):
    job_id = insert_job(pipeline_db, PAYLOAD)

    assert worker.run_once(pipeline_db, "w1", clock=lambda: 1000)

    status, attempts, error, payload = job_row(pipeline_db, job_id)
    assert (status, attempts, error, payload) == ("done", 1, None, "[]")
    masters = pipeline_db.execute("SELECT title, year, variant_count, best_quality FROM master_media ORDER BY title").fetchall()
    assert masters == [("Other Film", None, 1, None), ("The Movie", 2020, 2, "4K")]
    variants = pipeline_db.execute(
        "SELECT stream_id, label, quality_score, audio_languages, is_hdr FROM media_variants ORDER BY quality_score DESC"
    ).fetchall()
    assert variants[0][:2] == ("55", "4K")
    assert variants[0][3] == "[]"
    assert not worker.run_once(pipeline_db, "w1")


def test_complete_replaces_previous_library_for_same_scope_only(pipeline_db):
    insert_job(pipeline_db, PAYLOAD)
    insert_job(pipeline_db, PAYLOAD, account_id="acc-2")
    worker.run_once(pipeline_db, "w1")
    worker.run_once(pipeline_db, "w1")

    insert_job(pipeline_db, json.dumps([{"id": "99", "name": "Fresh (2022)"}]))
    worker.run_once(pipeline_db, "w1")

    titles = pipeline_db.execute("SELECT account_id, title FROM master_media ORDER BY account_id, title").fetchall()
    assert titles == [("acc-1", "Fresh"), ("acc-2", "Other Film"), ("acc-2", "The Movie")]


def test_claim_takes_oldest_pending_only(pipeline_db):
    insert_job(pipeline_db, "[]", status="done")
    second = insert_job(pipeline_db, "[]")
    insert_job(pipeline_db, "[]")

    job = repository.claim_next(pipeline_db, "w1", now=5)

    assert job.id == second
    assert pipeline_db.execute("SELECT status, locked_by, started_at FROM normalization_jobs WHERE id = ?", (second,)).fetchone() == (
        "processing",
        "w1",
        5,
    )


def test_bad_payload_retries_then_fails(pipeline_db):
    job_id = insert_job(pipeline_db, "{not json")

    for expected_status in ("pending", "pending", "failed"):
        assert worker.run_once(pipeline_db, "w1")
        assert job_row(pipeline_db, job_id)[0] == expected_status

    assert "JSONDecodeError" in job_row(pipeline_db, job_id)[2]
    assert not worker.run_once(pipeline_db, "w1")


def test_requeue_stale_processing_jobs(pipeline_db):
    stale = insert_job(pipeline_db, "[]", status="processing", attempts=1, started_at=0)
    exhausted = insert_job(pipeline_db, "[]", status="processing", attempts=3, started_at=0)
    fresh = insert_job(pipeline_db, "[]", status="processing", attempts=1, started_at=990)

    assert repository.requeue_stale(pipeline_db, now=1000, stale_seconds=600, max_attempts=3) == 2

    assert [job_row(pipeline_db, job_id)[0] for job_id in (stale, exhausted, fresh)] == ["pending", "failed", "processing"]


def test_failed_complete_rolls_back(pipeline_db, monkeypatch):
    insert_job(pipeline_db, PAYLOAD)
    worker.run_once(pipeline_db, "w1")
    job_id = insert_job(pipeline_db, json.dumps([{"id": "1", "name": "Dup"}, {"id": "1", "name": "Dup 4K"}]))

    worker.run_once(pipeline_db, "w1")

    # Duplicate stream ids violate the primary key; previous library must survive intact.
    assert job_row(pipeline_db, job_id)[0] == "pending"
    assert pipeline_db.execute("SELECT COUNT(*) FROM master_media").fetchone()[0] == 2


def test_main_once_exits_when_db_missing(tmp_path):
    assert worker.main(["--db", str(tmp_path / "missing.db"), "--once"]) == 1
