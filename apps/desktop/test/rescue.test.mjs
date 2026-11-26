import assert from 'node:assert/strict';
import { test } from 'node:test';

// rescue.mjs imports Electron, which only exists inside Electron: the version rule is tested through its source.
const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('../rescue.mjs', import.meta.url), 'utf8'));
const newerVersion = new Function(`${/export const newerVersion = ([\s\S]*?\n};)/.exec(source)[1].replace(/^/, 'return ')}`)();

test('the rescue window offers only a newer version', () => {
  assert.equal(newerVersion('3.1.9', '3.1.0'), true);
  assert.equal(newerVersion('3.2.0', '3.1.99'), true);
  assert.equal(newerVersion('3.1.0', '3.1.0'), false);
  assert.equal(newerVersion('3.0.9', '3.1.0'), false);
  assert.equal(newerVersion('10.0.0', '9.9.9'), true);
});
