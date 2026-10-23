# downloads

`downloadsStore.ts`: starts native downloads (original file probed first, HLS fallback), stores metadata JSON with each download, listens to `onDownloadsChanged`, polls progress every second while active, pause/resume/remove.

`useDownload.ts`: a title's download for the shared details' button and episode menu (D-078, D-203).
