# backup

`backupFiles.ts`: what the shared backup dialog (`packages/screens`, D-216) needs from the desktop. Account menu → **Back up & restore** and **Restore from a backup** on the login page. Back up encrypts this browser's saved sign-in, profiles, PIN, progress and My List with a password (`exportUserData`, D-056) and downloads a `.iptvbackup` file. Restore decrypts a file picked with the browser's file chooser (`importUserData`) and reloads the page.
