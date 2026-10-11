// node --test scripts/check-features-technical.test.mjs (part of npm run lint:features)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anchor, checkFeaturesTechnical } from './check-features-technical.mjs';

const ALL = '**Apps:** TV ✅ · Phone ✅ · Desktop ✅';
const features = (apps = ALL) => `# Features

## Player

### Playback controls

Play and pause.

${apps}

### Version choice and "(best)"

The best version.

${ALL}
`;
const row = (title, code = '`src/player.ts`') => `| [${title}](FEATURES.md#${anchor(title)}) | ${code} |`;
const index = (...rows) => `# Features: code index\n\n## Player\n\n| Feature | Code |\n|---------|------|\n${rows.join('\n')}\n`;
const exists = (path) => path === 'src/player.ts';
const both = () => index(row('Playback controls'), row('Version choice and "(best)"'));

test('agrees when every feature marks its apps and has a linked row with existing code', () => {
  assert.deepEqual(checkFeaturesTechnical(features(), both(), exists), []);
});

test('anchors follow GitHub', () => {
  assert.equal(anchor('Version choice and "(best)"'), 'version-choice-and-best');
  assert.equal(anchor('Focus in the middle (TV)'), 'focus-in-the-middle-tv');
  assert.equal(anchor('Titles, channels and programmes'), 'titles-channels-and-programmes');
});

test('a feature without an Apps line, or with an app unmarked, fails', () => {
  const missing = checkFeaturesTechnical(features('No line.'), both(), exists);
  assert.match(missing[0], /has no \*\*Apps:\*\* line/);
  const unmarked = checkFeaturesTechnical(features('**Apps:** TV ✅ · Phone ✅'), both(), exists);
  assert.match(unmarked[0], /does not mark Desktop/);
});

test('⏳ needs the issue that adds it', () => {
  const errors = checkFeaturesTechnical(features('**Apps:** TV ✅ · Phone ✅ · Desktop ⏳'), both(), exists);
  assert.match(errors[0], /names no issue/);
  assert.deepEqual(checkFeaturesTechnical(features('**Apps:** TV ✅ · Phone ✅ · Desktop ⏳ (#240)'), both(), exists), []);
});

test('a feature without a row fails, and so does a row without a feature', () => {
  const errors = checkFeaturesTechnical(features(), index(row('Playback controls'), row('Old feature')), exists);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /"### Version choice and "\(best\)"" .* has no entry/);
  assert.match(errors[1], /"### Old feature" is not a heading/);
});

test('rows in another order fail', () => {
  const errors = checkFeaturesTechnical(features(), index(row('Version choice and "(best)"'), row('Playback controls')), exists);
  assert.match(errors[0], /not in the order/);
});

test('a row with a wrong link, no code or a missing path fails', () => {
  const doc = index('| [Playback controls](FEATURES.md#play) | none |', row('Version choice and "(best)"', '`src/gone.ts`'));
  assert.deepEqual(
    checkFeaturesTechnical(features(), doc, exists).map((error) => error.replace(/^.*\) ?: /, '')),
    ['does not link to FEATURES.md#playback-controls', 'names no code path', '`src/gone.ts` does not exist'],
  );
});
