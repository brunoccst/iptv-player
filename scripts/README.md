# scripts

| Script | Purpose |
|--------|---------|
| `start-e2e-stack.sh` | Starts fake panel (`:8091`), backend (`:5091`, all interfaces, temp `DATA_DIR`) and normalizer worker in the background. Needs `services/title-normalizer/.venv` and generated panel media. |
| `stop-e2e-stack.sh [panel] [backend] [worker]` | Stops them (default: all). |

Used by `.github/workflows/tv-app.yml` and `apps/tv-app/e2e/run.sh`.
