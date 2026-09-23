# Xtream

| File | Purpose |
|------|---------|
| `XtreamCodesProvider.cs` | `IMediaProvider` for `player_api.php`. Builds `/live`, `/movie`, `/series` stream URLs. |
| `LooseJson.cs` | `JsonElement` readers that accept string/number/null variants of the same field. |

Actions used: login (no action), `get_live_categories`, `get_live_streams`, `get_vod_categories`, `get_vod_streams`, `get_vod_info`, `get_series_categories`, `get_series`, `get_series_info`.
