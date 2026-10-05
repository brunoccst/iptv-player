#!/usr/bin/env node
// Release notes for every published build (DECISIONS.md#d-143). documentation/RELEASE-NOTES.md has one `## <app>`
// part per app and, inside it, one `### MAJOR.MINOR` section per version line, newest first. A build MAJOR.MINOR.PATCH
// (D-070) publishes the section of its MAJOR.MINOR, so raising MAJOR.MINOR in a package.json needs a new section.
// Usage:
//   node scripts/release-notes.mjs tv|desktop [MAJOR.MINOR.PATCH]   prints the notes (default: the package.json version)
//   node scripts/release-notes.mjs --check                          npm run lint:release-notes: both apps have notes
import { readFileSync } from 'node:fs';

const NOTES_FILE = 'documentation/RELEASE-NOTES.md';
export const APPS = {
  tv: { heading: 'TV and phone app', packageFile: 'apps/tv-app/package.json' },
  desktop: { heading: 'Desktop app', packageFile: 'apps/desktop/package.json' },
};

/** "1.2" from "1.2.3" (or "1.2"); null without one. */
export const majorMinor = (version) =>
  /^(\d+)\.(\d+)(?:\.\d+)?$/
    .exec(version ?? '')
    ?.slice(1, 3)
    .join('.') ?? null;

/** The Markdown of an app's `### MAJOR.MINOR` section, without its heading; null when it is missing or empty. */
export function sectionFor(notes, app, version) {
  const line = majorMinor(version);
  if (!APPS[app] || !line) return null;
  let inApp = false;
  let section = null;
  for (const text of notes.split('\n')) {
    if (text.startsWith('## ')) {
      if (section) break;
      inApp = text.slice(3).trim() === APPS[app].heading;
    } else if (text.startsWith('### ')) {
      if (section) break;
      if (inApp && text.slice(4).trim() === line) section = [];
    } else if (section) section.push(text);
  }
  const body = section?.join('\n').trim();
  return body ? body : null;
}

/** Problems with the notes for the apps' current versions (`versions`: app → package.json version). */
export function checkNotes(notes, versions) {
  return Object.entries(versions).flatMap(([app, version]) =>
    sectionFor(notes, app, version)
      ? []
      : [`${NOTES_FILE}: no "### ${majorMinor(version) ?? version}" section under "## ${APPS[app].heading}" (${APPS[app].packageFile})`],
  );
}

const versionOf = (app) => JSON.parse(readFileSync(APPS[app].packageFile, 'utf8')).version;

if (import.meta.url === `file://${process.argv[1]}`) {
  const notes = readFileSync(NOTES_FILE, 'utf8');
  const [app, version] = process.argv.slice(2);
  if (app === '--check') {
    const errors = checkNotes(notes, Object.fromEntries(Object.keys(APPS).map((key) => [key, versionOf(key)])));
    if (errors.length) {
      console.error(`Release notes:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
      process.exit(1);
    }
    console.log(`Release notes: ${NOTES_FILE} has notes for every app's version.`);
  } else {
    if (!APPS[app]) throw new Error(`Usage: release-notes.mjs ${Object.keys(APPS).join('|')} [version] | --check`);
    const section = sectionFor(notes, app, version ?? versionOf(app));
    if (!section) {
      console.error(checkNotes(notes, { [app]: version ?? versionOf(app) })[0]);
      process.exit(1);
    }
    console.log(section);
  }
}
