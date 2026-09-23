# epg

Pure helpers for the TV guide grid, shared by web and TV. Rationale: [D-032](../../../../documentation/DECISIONS.md#d-032).

| File | Exports |
|------|---------|
| `guide.ts` | `EPG_SLOT_MS`, `floorToSlot`, `guideSlots`, `layoutGuideRow` (clip, trim overlaps, fill gaps), `nowFraction`, `programmeAt`, `programmeProgress`, `formatGuideTime`, `formatProgrammeTime`. |
| `guide.test.ts` | Unit tests. |

Cells carry `left`/`width` as fractions of the window, so web uses percentages and TV multiplies by the row width in dp.
