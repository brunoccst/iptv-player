# services

Python background services. Run locally (phase 1). Future deploy target: Azure Functions.

| Service | Description |
|---------|-------------|
| [`title-normalizer`](./title-normalizer) | Parses messy IPTV titles and groups duplicates into master media objects. Worker reads jobs from `pipeline.db`. |
