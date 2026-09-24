# browse

| File | Purpose |
|------|---------|
| `BrowsePage.tsx` | Movies/Series page: category chips (selection kept in `uiStore.categoryId`, set by Home row titles) + `PagedGrid` (100 per page, next page loads with a spinner when the end scrolls into view). |
| `SearchPage.tsx` | Debounced search across movies and series. |
