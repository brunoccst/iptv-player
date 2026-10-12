/**
 * Finds saved titles again after the library changed their ids (issue #216, DECISIONS.md#d-133). A title's id follows its
 * name and year, so a provider that renames entries gives the same title a new id; the provider's items (stream ids) stay.
 */
export interface TitleLookup {
  /** The provider items of those of `ids` that are titles of the library now. */
  itemsOf(ids: string[]): Promise<Map<string, string[]>>;
  /** The title that holds each of these provider items, when one does. */
  holdersOf(streamIds: string[]): Promise<Map<string, string>>;
}

export interface SavedTitle {
  masterId: string;
  /** The provider items the title had when last seen. */
  streamIds: string[];
}

export interface Reattached {
  /** The provider items of each saved title the library still has. */
  items: Map<string, string[]>;
  /** Old id → the title that holds most of its items now. */
  moved: Map<string, string>;
}

export async function reattachTitles(lookup: TitleLookup, saved: SavedTitle[]): Promise<Reattached> {
  const items = await lookup.itemsOf([...new Set(saved.map((title) => title.masterId))]);
  const lost = saved.filter((title) => !items.has(title.masterId) && title.streamIds.length > 0);
  const moved = new Map<string, string>();
  if (!lost.length) return { items, moved };
  const holders = await lookup.holdersOf([...new Set(lost.flatMap((title) => title.streamIds))]);
  for (const title of lost) {
    const votes = new Map<string, number>();
    for (const streamId of title.streamIds) {
      const holder = holders.get(streamId);
      if (holder) votes.set(holder, (votes.get(holder) ?? 0) + 1);
    }
    const best = [...votes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best) moved.set(title.masterId, best[0]);
  }
  return { items, moved };
}
