# Known issues

Open limits, risks and technical debt. A fixed issue is removed and its ID listed under [Closed](#closed).

| ID | Type | Area | Issue |
|----|------|------|-------|
| [KI-002](#ki-002) | Limitation | desktop | Web offline cache is not tamper-proof |
| [KI-004](#ki-004) | Limitation | providers | Provider constraints |
| [KI-006](#ki-006) | Tech debt | tooling | Transitive npm deprecation warnings |
| [KI-013](#ki-013) | Limitation | title grouping | Title ids follow the name and year |
| [KI-014](#ki-014) | Limitation | title grouping | Matching blind spots |
| [KI-020](#ki-020) | Risk | desktop | Timeline previews use a second stream connection |
| [KI-021](#ki-021) | Limitation | desktop | Downloads run in the page |
| [KI-022](#ki-022) | Limitation | desktop | Live channels need HLS output |
| [KI-023](#ki-023) | Limitation | desktop | No deep links |
| [KI-024](#ki-024) | Limitation | desktop | Hero trailers depend on YouTube |
| [KI-028](#ki-028) | Limitation | tv-app | Hold-to-scrub not covered by device tests |
| [KI-029](#ki-029) | Limitation | build env | No Android build or emulator in the cloud container |
| [KI-031](#ki-031) | Limitation | guide | Guide windows align to UTC half hours |
| [KI-032](#ki-032) | Limitation | guide | No catch-up playback |
| [KI-034](#ki-034) | Limitation | all apps | No sync between devices |
| [KI-035](#ki-035) | Limitation | library | New names are parsed on the JavaScript thread |
| [KI-036](#ki-036) | Limitation | tv-app | Short guide; credentials in stream URLs |
| [KI-037](#ki-037) | Limitation | tv-app | TV screens avoid FlatList |
| [KI-038](#ki-038) | Limitation | downloads | Download rules run inside the apps |
| [KI-039](#ki-039) | Limitation | profiles | Kids profiles filter by category |
| [KI-040](#ki-040) | Limitation | backup | No password recovery; TV pickers need a file manager |
| [KI-041](#ki-041) | Limitation | tv-app | External players save no progress |
| [KI-043](#ki-043) | Limitation | tv-app | Some audio formats fail on hardware decoders |
| [KI-045](#ki-045) | Limitation | desktop | The desktop app plays only what Chromium plays |

---

## KI-002

**Web offline cache is not tamper-proof**

Downloads in the desktop app are AES-GCM chunks inside the browser storage, with a non-extractable key (D-024): copied files are ciphertext. Any script on the origin, DevTools included, can still ask the Service Worker for decrypted bytes. Closing it needs DRM, which Xtream providers do not offer. Accepted by the owner while the app is private.

## KI-004

**Provider constraints**

- Many panels answer on plain HTTP; the TV app allows cleartext traffic for them.
- Providers limit connections per account (`max_connections`); the apps do not check it before playing, so the provider refuses extra streams.
- Providers can block an account for a while after bursts of requests (seen as HTTP 401 on streams while login worked; guide requests run 2 at a time).
- Provider uptime is outside our control; the apps say when the provider stops answering (D-074).

## KI-006

**Transitive npm deprecation warnings**

`npm install` warns about packages pulled by Expo tooling and `@react-native-tvos/config-tv` (e.g. `glob@11`). Build time only. Resolve when upstream updates.

## KI-013

**Title ids follow the name and year**

A title's id is a hash of account, kind, compact key and year (D-133). If a provider renames entries so the key changes, or a year appears or disappears, the title gets a new id and its My List entry and progress no longer match it.

## KI-014

**Matching blind spots**

- Different spellings ("Redemption" / "Redemtion") stay apart: grouping needs the same key (D-133).
- Translated titles join only when the provider sends TMDB ids in its lists; many do not.
- Only English leading articles are ignored in keys.
- Unknown tags of four letters or more stay in the name and can split groups; add the tag to `tags.ts` with a case.

## KI-020

**Timeline previews use a second stream connection**

Hovering the timeline opens a hidden low-quality copy of the stream (D-023). On accounts with one connection, strict panels may refuse it (blank preview) or drop the main stream.

## KI-021

**Downloads run in the page**

In the desktop app, closing the window stops a download; it resumes from the last chunk when the user presses Resume. One download at a time. Browser storage quotas apply.

## KI-022

**Live channels need HLS output**

The desktop player requests live streams as `.m3u8`; panels that only offer `ts` do not play there. `mpegts.js` could play them.

## KI-023

**No deep links**

Desktop navigation state lives in `history.state` (D-025), not in URLs, so a reload returns to Home.

## KI-024

**Hero trailers depend on YouTube**

Trailers use the provider's YouTube id through `youtube-nocookie.com`: they need internet access, load a third-party frame and fail silently for removed videos (the backdrop stays).

## KI-028

**Hold-to-scrub not covered by device tests**

Maestro sends single key presses, so holding a key is covered by unit and component tests only (D-030). Remotes that report arrows only on release cannot scrub; presses in a row cover them (D-128).

## KI-029

**No Android build or emulator in the cloud container**

No `/dev/kvm`, and the network policy blocks `dl.google.com` (Android SDK, Google Maven), so native changes are verified by GitHub Actions (`tv-app.yml`, D-030). Two `expo-doctor` checks also fail there (Expo's schema API and React Native Directory are unreachable); run `npx expo-doctor` locally.

## KI-031

**Guide windows align to UTC half hours**

In time zones with a 15- or 45-minute offset (e.g. UTC+5:45) the guide starts on a local :15 or :45.

## KI-032

**No catch-up playback**

Channels report `hasCatchup`, but past programmes play the live channel (D-032). Catch-up needs the provider's `timeshift` URLs in `packages/shared/src/direct/xtream.ts`.

## KI-034

**No sync between devices**

Profiles, progress and My List live on each device (D-088). Pairing by QR code merges two devices once (D-060); after that they drift apart.

## KI-035

**New names are parsed on the JavaScript thread**

Grouping runs in SQL and an update regroups only what changed (D-133, D-135), but names never seen before are parsed in JavaScript, in slices. A first build parses every name: 150k names take minutes on a TV. Every update also downloads both whole lists, since the provider has no "changes since".

## KI-036

**Short guide; credentials in stream URLs**

The guide uses each channel's short EPG (up to 12 programmes), so it reaches fewer hours ahead than a full XMLTV guide. Xtream stream URLs contain the username and password; they stay on the device and are masked in the app's log (D-039), but can appear in Android's own logs and in Media3's download records (KI-038).

## KI-037

**TV screens avoid FlatList**

On Android TV, Home, the Movies/Series grid and My Downloads use a plain ScrollView (D-094): FlatList screens did not scroll on the TV emulator and the grid's FlatList got a 2 px viewport on real TVs. The cause is unknown. Phones keep the virtualized lists.

## KI-038

**Download rules run inside the apps**

The 30-day online check, the subscription check and deletion on sign-out (D-050) are enforced by the apps, not by the files. A modified app, DevTools or root access can get around them.

## KI-039

**Kids profiles filter by category**

Providers send no age ratings, so a Kids profile shows whole categories (by name, or the ones a parent picks, D-053). A kids title in a general category is hidden, and an unsuitable title in an allowed category shows. The parental PIN is per device (D-054). A convenience filter, not a lock.

## KI-040

**No password recovery; TV pickers need a file manager**

A backup can only be opened with its password (D-056). On Android TV the folder and file pickers come from a file manager app, which some TVs lack; the app then says so. Where the JavaScript engine has no `crypto.getRandomValues`, the salt and nonce fall back to `Math.random`: they only need to be unique, but a secure source would be better.

## KI-041

**External players save no progress**

Titles opened in another player (D-057) save no progress. The provider User-Agent goes in the `headers` extra, which MX Player and Just Player read; VLC uses its own, so providers that only accept certain players may refuse it there.

## KI-043

**Some audio formats fail on hardware decoders**

Some devices claim a format and then fail (a Pixel with Dolby Digital Plus). The player stops with a message naming the format; account menu → Library & devices → Playback → FFmpeg first fixes it on such devices (D-059).

## KI-045

**The desktop app plays only what Chromium plays**

MKV with H.264/AAC plays, and the web player asks for the panel's HLS output first (D-023). HEVC without a hardware decoder, MPEG-4/Xvid, MPEG-2 and Dolby Digital/DTS audio do not; the error names the codec (D-074) and offers Open in VLC (D-057). A lasting fix would embed libmpv.

## Closed

<a id="ki-001"></a><a id="ki-003"></a><a id="ki-005"></a><a id="ki-007"></a><a id="ki-008"></a><a id="ki-009"></a><a id="ki-010"></a><a id="ki-011"></a><a id="ki-012"></a><a id="ki-015"></a><a id="ki-016"></a><a id="ki-017"></a><a id="ki-018"></a><a id="ki-019"></a><a id="ki-025"></a><a id="ki-026"></a><a id="ki-027"></a><a id="ki-030"></a><a id="ki-033"></a><a id="ki-042"></a><a id="ki-044"></a>

| IDs | Why |
|-----|-----|
| KI-001, KI-008, KI-009, KI-011, KI-012, KI-015, KI-016, KI-017, KI-018, KI-026, KI-030 | The server is gone (D-088). |
| KI-003 | Android downloads are encrypted (D-050). |
| KI-005, KI-027, KI-033 | Done: the `tv-media` module (D-029), profile management on TV, emulator playback green. |
| KI-007 | Merged into KI-029. |
| KI-010 | Merged into KI-045. |
| KI-019 | Skip Intro became "Skip ahead" (D-042). |
| KI-025 | Episodes merge across versions (D-066). |
| KI-042 | A temporary provider block; folded into KI-004. |
| KI-044 | Grouping moved to SQL (D-133). |
