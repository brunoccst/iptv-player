# title_normalizer

Pure Python package. No Azure SDK imports.

| Module | Purpose |
|--------|---------|
| `tags.py` | Tag vocabularies (quality, source, languages, prefix-only country codes like "GE - ", audio, ignored tokens) and ranking tables. |
| `parser.py` | `parse_title()`: raw title → `ParsedTitle` (clean title, key, year, quality, source, audio, subtitles, HDR). |
| `matching.py` | `group_titles()`: exact key+year groups, year-less joins, fuzzy merge (rapidfuzz). |
| `pipeline.py` | `build_masters()`: groups → `Master` + `Variant` records (ids, labels, scores). |
| `repository.py` | SQLite queue operations: claim, complete, fail, requeue stale. |
| `worker.py` | Polling loop and CLI. |
| `config.py` | Loads `Settings` from root `.env` / environment. |
| `__main__.py` | `python -m title_normalizer` entry. |
