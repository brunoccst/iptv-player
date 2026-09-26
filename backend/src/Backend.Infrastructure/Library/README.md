# Library

| File | Purpose |
|------|---------|
| `LibrarySyncService.cs` | Fetches full VOD + series lists, writes one `pending` job per kind (replaces an existing pending job). |
| `LibrarySyncQueue.cs` | In-process queue + `LibrarySyncWorker` background service that runs syncs off the request thread. |
| `LibraryRefreshScheduler.cs` | `LibraryRefreshService` finds signed-in accounts whose last sync is older than `BACKEND_LIBRARY_REFRESH_HOURS`; `LibraryRefreshScheduler` queues them at start and every 30 min (D-051). |
| `LibraryService.cs` | Reads master cards (paging, category, search, audio/subtitle language), master details with variants, and sync status. |
