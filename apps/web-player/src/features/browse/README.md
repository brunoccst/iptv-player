# browse

| File | Purpose |
|------|---------|
| `BrowsePage.tsx` | Movies/Series page: category chips (selection kept in `uiStore.categoryId`, set by Home row titles) + `PagedGrid` (100 per page, next page loads with a spinner when the end scrolls into view; "Sort by" menu, choice kept per section in the library store, D-049). |
| `MyListPage.tsx` | "My List": the profile's saved titles as a grid, newest first (D-055). |
| `SearchPage.tsx` | Debounced search across movies and series. |
