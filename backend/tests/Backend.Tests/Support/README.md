# Support

| File | Purpose |
|------|---------|
| `ApiFactory.cs` | `WebApplicationFactory` with temp data dir; routes all outbound HTTP to `FakeXtreamServer`. |
| `FakeXtreamServer.cs` | In-memory Xtream panel (login, catalog, HLS playlist, ranged segment). |
| `XtreamFixtures.cs` | Sample panel JSON responses. |
| `StubHttpHandler.cs` | Delegate-based `HttpMessageHandler`. |
| `ApiClientExtensions.cs` | Login helpers, JSON options. |
