// node --test scripts/release-notes.test.mjs (part of npm run lint:release-notes)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkNotes, majorMinor, sectionFor } from './release-notes.mjs';

const notes = `# Release notes

## TV and phone app

### 1.1

- New in 1.1

### 1.0

- New in 1.0

## Desktop app

### 1.0

- Desktop 1.0

### 0.9
`;

test('a build publishes the section of its MAJOR.MINOR', () => {
  assert.equal(sectionFor(notes, 'tv', '1.1.7'), '- New in 1.1');
  assert.equal(sectionFor(notes, 'tv', '1.0.0'), '- New in 1.0');
  assert.equal(sectionFor(notes, 'desktop', '1.0.3'), '- Desktop 1.0');
});

test('another app, a missing or an empty section has no notes', () => {
  assert.equal(sectionFor(notes, 'desktop', '1.1.0'), null);
  assert.equal(sectionFor(notes, 'tv', '2.0.0'), null);
  assert.equal(sectionFor(notes, 'desktop', '0.9.1'), null);
  assert.equal(sectionFor(notes, 'phone', '1.0.0'), null);
});

test('the check names each app without notes for its version', () => {
  assert.deepEqual(checkNotes(notes, { tv: '1.1.0', desktop: '1.0.0' }), []);
  const errors = checkNotes(notes, { tv: '1.2.0', desktop: '1.0.0' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"### 1\.2" section under "## TV and phone app"/);
});

test('MAJOR.MINOR of a version', () => {
  assert.equal(majorMinor('1.2.3'), '1.2');
  assert.equal(majorMinor('1.2'), '1.2');
  assert.equal(majorMinor('v1'), null);
});
