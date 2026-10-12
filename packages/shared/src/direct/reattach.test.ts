import { describe, expect, it } from 'vitest';
import { reattachTitles, type TitleLookup } from './reattach';

/** A library of titles by id, each with its provider items. */
const library = (titles: Record<string, string[]>): TitleLookup => ({
  itemsOf: async (ids) => new Map(ids.filter((id) => titles[id]).map((id) => [id, titles[id]!])),
  holdersOf: async (streamIds) =>
    new Map(Object.entries(titles).flatMap(([id, items]) => items.filter((item) => streamIds.includes(item)).map((item) => [item, id]))),
});

describe('reattachTitles (issue #216)', () => {
  it('moves a lost title to the one that holds most of its items, and leaves known and hopeless ones', async () => {
    const lookup = library({ kept: ['1'], renamed: ['2', '3'], other: ['4'] });
    const result = await reattachTitles(lookup, [
      { masterId: 'kept', streamIds: [] },
      { masterId: 'old', streamIds: ['2', '3', '4'] },
      { masterId: 'gone', streamIds: ['9'] },
      { masterId: 'unknown', streamIds: [] },
    ]);
    expect([...result.items.keys()]).toEqual(['kept']);
    expect([...result.moved]).toEqual([['old', 'renamed']]);
  });
});
