# test

Jest support files for the TV app.

| File | Purpose |
|------|---------|
| `setup.ts` | Mocks `expo-constants` (app config), `expo-secure-store`, `expo-file-system` (with the folder and file pickers) and `expo-navigation-bar`. |
| `tvMediaMock.tsx` | Replaces the native `tv-media` module: in-memory downloads, recorded player props and seeks. |
| `remoteMock.ts` | Replaces `src/tv/remote.ts`; `pressRemote(key, action)` drives `useRemote` handlers. |
| `utils.tsx` | Fake backend (`fetch`), signed-in session setup, store resets. |
