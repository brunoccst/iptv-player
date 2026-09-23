# title-normalizer

Azure Function (Python 3.11, v2 programming model). Smart Title Normalizer Engine.

Current state: scaffold. Exposes `GET /api/health`. Parsing and fuzzy matching arrive in Step 3.

## Setup

```bash
cd services/title-normalizer
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
```

## Commands

```bash
python -m pytest                         # unit tests
cp local.settings.example.json local.settings.json
func start                               # needs Azure Functions Core Tools v4 + Azurite
```

## Config

`title_normalizer/config.py` reads `APP_NAME`, `APP_SLUG` from the repo root `.env` (then `.env.local`). Real env vars win.

## Structure

| Path | Purpose |
|------|---------|
| `function_app.py` | Function definitions (HTTP/queue triggers). |
| `host.json` | Functions host config. |
| `title_normalizer/` | Pure Python logic. No Azure imports. |
| `tests/` | pytest suite. |
