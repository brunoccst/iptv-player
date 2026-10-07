// node --test scripts/check-features-technical.test.mjs (part of npm run lint:features)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anchor, checkFeaturesTechnical } from './check-features-technical.mjs';

const features = `# Features

## Player

### Playback controls

Play and pause.

### Version choice and "(best)"

The best version.
`;
const entry = (title, code = '`src/player.ts`') =>
  `### ${title}\n\n[What it does](FEATURES.md#${anchor(title)})\n\n${graph}How it works.\n\n**Code:** ${code}\n`;
const graph = '```mermaid\nflowchart LR\n  A --> B\n```\n\n';
const technical = (...entries) => `# Features: how they work\n\n## Player\n\n${entries.join('\n')}`;
const exists = (path) => path === 'src/player.ts';

test('agrees when every feature has a linked section with an explanation and existing code', () => {
  const doc = technical(entry('Playback controls'), entry('Version choice and "(best)"'));
  assert.deepEqual(checkFeaturesTechnical(features, doc, exists), []);
});

test('anchors follow GitHub', () => {
  assert.equal(anchor('Version choice and "(best)"'), 'version-choice-and-best');
  assert.equal(anchor('Focus in the middle (TV)'), 'focus-in-the-middle-tv');
  assert.equal(anchor('Titles, channels and programmes'), 'titles-channels-and-programmes');
});

test('a feature without a technical section fails, and so does a section without a feature', () => {
  const errors = checkFeaturesTechnical(features, technical(entry('Playback controls'), entry('Old feature')), exists);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /"### Version choice and "\(best\)"" .* has no section/);
  assert.match(errors[1], /"### Old feature" is not a heading/);
});

test('sections in another order fail', () => {
  const errors = checkFeaturesTechnical(features, technical(entry('Version choice and "(best)"'), entry('Playback controls')), exists);
  assert.match(errors[0], /not in the order/);
});

test('a section without its link, graph, explanation or code line fails', () => {
  const bare = `### Playback controls\n\n${graph}**Code:** \`src/player.ts\`\n`;
  const noCode = '### Version choice and "(best)"\n\n[x](FEATURES.md#version-choice-and-best)\n\nText.\n';
  const errors = checkFeaturesTechnical(features, technical(bare, noCode), exists);
  assert.deepEqual(
    errors.map((error) => error.replace(/^.*\) ?: /, '')),
    ['does not link to FEATURES.md#playback-controls', 'has no explanation', 'has no Mermaid graph', 'has no **Code:** line'],
  );
});

test('a code path that does not exist fails', () => {
  const doc = technical(entry('Playback controls', '`src/gone.ts`'), entry('Version choice and "(best)"'));
  assert.match(checkFeaturesTechnical(features, doc, exists)[0], /`src\/gone.ts` does not exist/);
});
