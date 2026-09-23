# Support

| File | Purpose |
|------|---------|
| `ApiFactory.cs` | `WebApplicationFactory` with temp data dir; routes all outbound HTTP to `FakeXtreamServer`. |
| `FakeXtreamServer.cs` | In-memory Xtream panel (login, catalog, XMLTV + short EPG, HLS playlist, ranged segment). |
| `XtreamFixtures.cs` | Sample panel JSON responses. |
| `StubHttpHandler.cs` | Delegate-backed `HttpMessageHandler`; records requests; per-test `Override`. |
| `ApiClientExtensions.cs` | Login helpers, JSON options. |
