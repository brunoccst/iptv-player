"""Queue worker: polls pipeline.db for normalization jobs. Run with `python -m title_normalizer`."""

import argparse
import json
import logging
import os
import socket
import sqlite3
import time
from collections.abc import Callable
from pathlib import Path

from title_normalizer import repository
from title_normalizer.config import load_settings
from title_normalizer.pipeline import build_masters

logger = logging.getLogger("title_normalizer.worker")

MAX_ATTEMPTS = 3
STALE_SECONDS = 600


def run_once(connection: sqlite3.Connection, worker_id: str, clock: Callable[[], float] = time.time) -> bool:
    """Processes at most one job. Returns True if a job was claimed."""
    job = repository.claim_next(connection, worker_id, int(clock()))
    if job is None:
        return False

    started = time.perf_counter()
    try:
        items = json.loads(job.payload)
        if not isinstance(items, list):
            raise ValueError("Job payload must be a JSON array.")
        masters = build_masters(job.account_id, job.media_kind, items)
        repository.complete(connection, job, masters, int(clock()))
        logger.info("Job %s (%s): %s items -> %s masters in %.2fs",
                    job.id, job.media_kind, len(items), len(masters), time.perf_counter() - started)
    except Exception as exception:  # noqa: BLE001 - any failure must be recorded on the job, never crash the loop.
        logger.exception("Job %s failed", job.id)
        repository.fail(connection, job, f"{type(exception).__name__}: {exception}", int(clock()), MAX_ATTEMPTS)
    return True


def drain(connection: sqlite3.Connection, worker_id: str) -> int:
    repository.requeue_stale(connection, int(time.time()), STALE_SECONDS, MAX_ATTEMPTS)
    processed = 0
    while run_once(connection, worker_id):
        processed += 1
    return processed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="title_normalizer", description="Processes normalization jobs from pipeline.db.")
    parser.add_argument("--db", type=Path, help="Path to pipeline.db. Default: <DATA_DIR>/pipeline.db from root .env.")
    parser.add_argument("--once", action="store_true", help="Process all pending jobs, then exit.")
    parser.add_argument("--interval", type=float, default=5.0, help="Seconds between polls (default 5).")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    db_path = args.db or load_settings().pipeline_db_path
    worker_id = f"{socket.gethostname()}:{os.getpid()}"
    logger.info("Worker %s using %s", worker_id, db_path)

    while not db_path.exists():
        if args.once:
            logger.error("%s does not exist. Start the backend once to create it.", db_path)
            return 1
        logger.info("Waiting for backend to create %s", db_path)
        time.sleep(args.interval)

    connection = repository.connect(db_path)
    try:
        while True:
            if repository.schema_ready(connection):
                drain(connection, worker_id)
            else:
                logger.info("Waiting for backend migrations in %s", db_path)
            if args.once:
                return 0
            time.sleep(args.interval)
    except KeyboardInterrupt:
        return 0
    finally:
        connection.close()
