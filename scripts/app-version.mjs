#!/usr/bin/env node
// Prints the TV/phone app version, MAJOR.MINOR.PATCH (Semantic Versioning, DECISIONS.md#d-070).
// MAJOR.MINOR come from apps/tv-app/package.json and are raised by hand there (write X.Y.0). PATCH counts the builds
// on main since then: the commits on main's first-parent line that already carry this MAJOR.MINOR, minus one, so the
// first build of 1.2 is 1.2.0 and the next one 1.2.1. Needs the full history (actions/checkout fetch-depth: 0).
import { execFileSync } from 'node:child_process';

const FILE = 'apps/tv-app/package.json';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const majorMinor = (commit) => {
  try {
    const match = /^(\d+)\.(\d+)\.\d+/.exec(JSON.parse(git('show', `${commit}:${FILE}`)).version ?? '');
    return match ? `${match[1]}.${match[2]}` : null;
  } catch {
    return null; // No such file in that commit.
  }
};

const head = process.argv[2] ?? 'HEAD';
const base = majorMinor(head);
if (!base) throw new Error(`No MAJOR.MINOR.PATCH version in ${FILE}`);
let same = 0;
for (const commit of git('rev-list', '--first-parent', head).split('\n')) {
  if (majorMinor(commit) !== base) break;
  same++;
}
console.log(`${base}.${same - 1}`);
