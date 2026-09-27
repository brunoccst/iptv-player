// node --test scripts/check-parity.test.mjs (part of npm run lint:parity)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkParity } from './check-parity.mjs';

const table = (rows) => `## Features

| Feature | TV | Phone | Web / desktop | How |
|---------|----|-------|---------------|-----|
${rows.join('\n')}
`;
const backlog = (...titles) =>
  `## Backlog\n\n${titles.map((title) => `- [ ] **Parity: ${title}** (requested): …`).join('\n')}\n\n## Done\n\n- [x] **Parity: old** done\n`;

test('agrees when every app cell is marked and every ⏳ has an open backlog item', () => {
  const parity = table([
    '| Menu | ✅ | ✅ | ✅ | |',
    '| Guide | ✅ | ✅ | ⏳ | backlog: Parity: guide on web |',
    '| Sleep | ✅ | ➖ | ➖ | |',
  ]);
  assert.deepEqual(checkParity(parity, backlog('guide on web')), []);
});

test('an unmarked app cell fails', () => {
  const errors = checkParity(table(['| Menu | ✅ | | ✅ | |']), backlog());
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Menu.*column 3 has no/);
});

test('⏳ without a backlog item, or naming one that is not open, fails', () => {
  assert.match(checkParity(table(['| Guide | ✅ | ✅ | ⏳ | |']), backlog())[0], /names no backlog item/);
  const errors = checkParity(table(['| Guide | ✅ | ✅ | ⏳ | backlog: Parity: old |']), backlog());
  assert.match(errors[0], /"Parity: old" is not an open item/);
});

test('an open parity backlog item the table does not name fails', () => {
  const errors = checkParity(table(['| Menu | ✅ | ✅ | ✅ | |']), backlog('forgotten feature'));
  assert.match(errors[0], /open item "Parity: forgotten feature" is not named/);
});

test('the Looks table is not checked for marks', () => {
  const parity = `## Looks\n\n| Element | TV (remote) | Phone | Web |\n|--|--|--|--|\n| Card | ring | pressed | ring |\n\n${table(['| Menu | ✅ | ✅ | ✅ | |'])}`;
  assert.deepEqual(checkParity(parity, backlog()), []);
});
