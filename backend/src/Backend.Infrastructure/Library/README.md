# Library

| File | Purpose |
|------|---------|
| `LibrarySyncService.cs` | Fetches full VOD + series lists, writes one `pending` job per kind (replaces an existing pending job). |
| `LibrarySyncQueue.cs` | In-process queue + `LibrarySyncWorker` background service that runs syncs off the request thread. |
| `LibraryService.cs` | Reads master cards (paging, category, search), master details with variants, and sync status. |
