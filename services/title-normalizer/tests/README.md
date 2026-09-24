# tests

pytest suite. Run from `services/title-normalizer`: `python -m pytest`.

| File | Covers |
|------|--------|
| `cases/` | JSON cases shared with the TypeScript port; `cases_loader.py` reads them. |
| `conftest.py` | `pipeline_db` fixture built from `backend/.../Pipeline/pipeline-schema.sql`; job insert helper. |
| `test_parser.py` | Tag extraction and title-word protection (`cases/parser.json`). |
| `test_matching.py` | Grouping rules (`cases/matching.json`). |
| `test_pipeline.py` | Master assembly, stable ids, labels, scores (plus `cases/pipeline.json`). |
| `test_repository_and_worker.py` | Queue claim/complete/fail/retry, stale requeue, rollback. |
| `test_config.py` | `.env` loading and `DATA_DIR` resolution. |
