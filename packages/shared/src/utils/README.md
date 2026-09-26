# utils

| File | Exports |
|------|---------|
| `format.ts` | `formatDuration(seconds)` → `1h 30m`; `formatClock(seconds)` → `1:02:03`. |
| `logger.ts` | `appLog` (shared diagnostics log, ring buffer of 600 lines from the last 3 days, saved across restarts with `persist`), `createLogger`, `redact` (masks Xtream usernames and passwords), `errorMessage`. [D-039](../../../../documentation/DECISIONS.md#d-039). |
| `logger.test.ts` | Masking, ring buffer, age limit, restore of the previous session. |
