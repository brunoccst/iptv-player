// The checked-in name parser (issue #228, DECISIONS.md#d-188) matches its source and reads names like the app does.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { nameParserScript, OUTPUT } from './build-name-parser.mjs';

const script = readFileSync(OUTPUT, 'utf8');
const cases = JSON.parse(
  readFileSync(new URL('../../../packages/shared/src/direct/normalizer/cases/parser.json', import.meta.url), 'utf8'),
).parse;

test('the checked-in parser is up to date (run npm run build:name-parser --workspace=@iptv/tv-app)', async () => {
  assert.equal(script, await nameParserScript());
});

test('the parser reads the shared test names like the app', () => {
  const context = vm.createContext({});
  vm.runInContext(script, context);
  // Through JSON, as the WebView answers.
  const rows = JSON.parse(vm.runInContext(`JSON.stringify(parseNames(${JSON.stringify(cases.map((c) => c.raw))}))`, context));
  assert.equal(rows.length, cases.length);
  cases.forEach((c, i) => {
    const [title, , , year, quality, source, audio, audioTag, hdr] = rows[i];
    const read = { title, year, quality, source, audioTag, hdr: hdr === 1, languages: audio.split(',').filter(Boolean) };
    for (const field of Object.keys(c).filter((k) => k !== 'raw' && k in read)) {
      assert.deepEqual(read[field], c[field], `${c.raw}: ${field}`);
    }
  });
});
