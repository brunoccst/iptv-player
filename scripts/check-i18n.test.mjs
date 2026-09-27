import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkCatalog, extractTexts } from './check-i18n.mjs';

const code = `
import { t, tn } from '@iptv/shared';
export function Row({ title, count }) {
  return <p aria-label={t('Play {title}', { title })}>{tn('{count} episode', '{count} episodes', count)}</p>;
}
`;

test('finds the English texts of t and tn', () => {
  const { texts, errors } = extractTexts(code, 'Row.tsx');
  assert.deepEqual(errors, []);
  assert.deepEqual(
    texts.map(({ key, other }) => [key, other]),
    [
      ['Play {title}', undefined],
      ['{count} episode', '{count} episodes'],
    ],
  );
});

test('text that is not a literal, and t when the module loads, fail', () => {
  const { errors } = extractTexts("const LABEL = t('Home');\nexport const f = (key) => t(key);", 'a.ts');
  assert.equal(errors.length, 2);
  assert.match(errors[0], /a\.ts:1: t\(\) runs when the module loads/);
  assert.match(errors[1], /a\.ts:2: t\(\) needs its English text as a string literal/);
});

test('a catalog must have every text, its plural forms and only known placeholders', () => {
  const { texts } = extractTexts(code, 'Row.tsx');
  assert.deepEqual(
    checkCatalog(
      'de',
      { 'Play {title}': '{title} abspielen', '{count} episode': { one: '{count} Folge', other: '{count} Folgen' } },
      texts,
    ),
    [],
  );
  assert.deepEqual(
    checkCatalog(
      'sh-BA',
      { 'Play {name}': 'Pusti {name}', Old: 'Staro', '{count} episode': { one: '{count} epizoda', other: '{count} epizoda' } },
      texts,
    ),
    [
      'sh-BA: missing "Play {title}" (Row.tsx:4)',
      'sh-BA: "{count} episode" has no "few" form',
      'sh-BA: "Play {name}" is not used any more',
      'sh-BA: "Old" is not used any more',
    ],
  );
  assert.deepEqual(checkCatalog('de', { 'Play {title}': '{name} abspielen', '{count} episode': '{count} Folgen' }, texts), [
    'de: "Play {title}" uses {name}, which the English text does not have',
    'de: "{count} episode" must be plural forms {one, …, other}',
  ]);
});
