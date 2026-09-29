# live

| File                  | Purpose                                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LiveTvPage.tsx`      | Live TV guide: categories, a 3-hour channel × time grid (Earlier / Now / Later, "More channels" paging), programme details. Clicking a channel plays it; a programme opens details with "Watch live". See [D-032](../../../../../documentation/DECISIONS.md#d-032). |
| `LiveTvPage.test.tsx` | Grid rendering, selection, playback target, paging and window shift.                                                                                                                                                                                                |

Layout math (`layoutGuideRow`, `nowFraction`) and paging/polling (`useEpgGuide`) come from `@iptv/shared`.
