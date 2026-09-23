# Epg

Electronic programme guide (TV guide) types. Rationale: [D-031](../../../../documentation/DECISIONS.md#d-031).

| File | Contents |
|------|----------|
| `EpgModels.cs` | `EpgProgramme` (provider entry), API records `EpgGrid`, `EpgChannelRow`, `EpgListing`, `EpgStatus`, `EpgChannelKeys`. |
| `EpgEntities.cs` | Cached rows `EpgProgrammeRow` and per-account `EpgState` (stored in `app.db`). |
