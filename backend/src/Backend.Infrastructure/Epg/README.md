# Epg

Guide (EPG) cache and reads. Rationale: [D-031](../../../../documentation/DECISIONS.md#d-031).

| File | Purpose |
|------|---------|
| `XmltvParser.cs` | Streaming `<programme>` reader with a time window; XMLTV time parsing. |
| `XmltvStreams.cs` | `GzipSniffer` (gzip bodies without `Content-Encoding`), `OwnedStream` (response lifetime). |
| `EpgRefreshQueue.cs` | `EpgRefreshQueue` (one pending entry per account) and `EpgRefreshWorker` (background download). |
| `EpgRefreshService.cs` | Downloads XMLTV and replaces the account's rows in one transaction (keeps now −3 h … +48 h). |
| `EpgService.cs` | `/api/epg` grid: cached rows by `epg_channel_id`, per-channel short EPG for the rest (cached 30 min). |
