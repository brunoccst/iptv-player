# backup

`BackupDialog.tsx`: account menu → **Back up & restore**, and **Restore from a backup** on the login page (restore only). Back up encrypts this browser's saved sign-in, profiles, PIN, progress and My List with a password (`exportUserData`, D-056) and downloads a `.iptvbackup` file. Restore decrypts a chosen file (`importUserData`) and reloads the page.
