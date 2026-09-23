# downloads

`downloadsStore.ts`: starts native downloads (original file probed first, HLS fallback), stores metadata JSON with each download, listens to `onDownloadsChanged`, polls progress every second while active, pause/resume/remove.
