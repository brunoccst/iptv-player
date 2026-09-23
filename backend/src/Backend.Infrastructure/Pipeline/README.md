# Pipeline

| Path | Purpose |
|------|---------|
| `PipelineDbContext.cs` | EF Core context for `pipeline.db`. snake_case tables/columns. |
| `Migrations/` | Generated migrations for `PipelineDbContext`. |
| `pipeline-schema.sql` | Generated schema snapshot. Python tests build their DB from it. Refresh: `UPDATE_PIPELINE_SCHEMA=1 dotnet test backend/Backend.sln`. |

Tables: `normalization_jobs` (queue), `master_media`, `media_variants`.
