# components

| File | Purpose |
|------|---------|
| `FocusButton.tsx` | D-pad button; focus = white fill / border + scale. |
| `PosterCard.tsx` | Poster or landscape card (badge, progress bar); images decoded at card size (`resizeMethod="resize"`); `testID="card-<title>"`. |
| `Row.tsx` | Titled horizontal list. |
| `SideRail.tsx` | Left navigation (☰ toggle, profile, Home, Search, Series, Movies, Live TV, Downloads, Log) in a `TVFocusGuideView`. ☰ collapses it to a 56 dp strip; the choice is saved in `fileStorage`. |
| `ProgressRing.tsx` | SVG progress circle. |
| `DownloadButton.tsx` | "Download" with progress ring; start / pause / resume. |
| `Feedback.tsx` | Loading indicator, error text, `errorText()` mapping. |
