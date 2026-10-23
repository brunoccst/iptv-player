# browse

| File             | Purpose                                                                                                                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BrowsePage.tsx` | Movies/Series page: the screen shared with the TV app (`@iptv/screens`, D-195), with the library banner under the title. The category is kept in `uiStore.categoryId`, set by Home row titles. |
| `PagedGrid.tsx` | Search results grid: 100 per page, the next page loads with a spinner when the end scrolls into view. |
| `screenHost.tsx` | What the desktop gives the shared screens (`ScreenHost`, D-194): window-scrolled page, details modal, right-click menu, a sensor that loads the next page. |
| `MyListPage.tsx` | "My List": the screen shared with the TV app (D-055, D-194). |
| `SearchPage.tsx` | Debounced search across movies and series.                                                                                                                                                                                                                                                                        |
