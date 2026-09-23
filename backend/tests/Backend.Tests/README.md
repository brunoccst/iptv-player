# Backend.Tests

xUnit tests. Run: `dotnet test backend/Backend.sln`.

| File | Covers |
|------|--------|
| `XtreamCodesProviderTests.cs` | URL normalization, JSON parsing quirks, errors, stream URL building. |
| `HlsPlaylistRewriterTests.cs` | Playlist URI rewriting. |
| `AuthAndProfileEndpointTests.cs` | Login, sessions, profile CRUD rules (in-memory API host). |
| `CatalogPlaybackRelayTests.cs` | Catalog caching, playback URLs, relay playlist + byte ranges. |
| `ProgressEndpointTests.cs` | Progress save/list/delete and ownership. |
| `LibraryEndpointTests.cs` | Sync queueing, job coalescing, library listing/details. |
| `EpgTests.cs` | XMLTV parsing (times, broken entries, gzip), short EPG decoding, `/api/epg` grid (cache, fallback, paging, no feed). |
| `PipelineSchemaContractTests.cs` | `pipeline-schema.sql` matches the EF model. |
| `DotEnvParserTests.cs`, `HealthEndpointTests.cs` | Config loading, health endpoint. |
| `Support/` | Test host, fake Xtream server, fixtures. |
