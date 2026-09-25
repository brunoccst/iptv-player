# auth

`LoginPage.tsx`: server URL + username + password form. Calls `session.login()`; shows provider errors via `errorText()`. "Restore from a backup" opens the restore dialog (`../backup`). `LoginPage.test.tsx` covers the request and error text.
