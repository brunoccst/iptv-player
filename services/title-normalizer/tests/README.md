# tests

pytest suite. Run from `services/title-normalizer`: `python -m pytest`.

| File | Covers |
|------|--------|
| `conftest.py` | `pipeline_db` fixture built from `backend/.../Pipeline/pipeline-schema.sql`; job insert helper. |
| `test_parser.py` | Tag extraction and title-word protection. |
| `test_matching.py` | Grouping rules: variants merge, sequels/remakes/short titles stay apart. |
| `test_pipeline.py` | Master assembly, stable ids, labels, scores. |
| `test_repository_and_worker.py` | Queue claim/complete/fail/retry, stale requeue, rollback. |
| `test_config.py` | `.env` loading and `DATA_DIR` resolution. |
