import { compactKey, type ParsedTitle } from './parser';

/**
 * Groups parsed titles that refer to the same work (D-017, D-133). The same rules as the library database's query
 * (`sqlLibrary`), which groups the titles there; this one serves the library kept in memory (no database):
 *
 * 1. Same compact key and year ("Spider-Man" == "Spiderman"). A year-less title takes the year of its key when the key
 *    has exactly one (dated titles of it); with several it stays apart.
 * 2. Titles with a TMDB id group by that id and year instead of the key, so keys that share one join (D-065) and two
 *    works of one name and year ("The Odyssey" 2026 by Nolan and by Walz) stay apart (D-156). A title without one takes
 *    its key's TMDB id when the key has exactly one; with several it stays with the key.
 *
 * Similar spellings ("Redemtion") no longer join (D-133): that step needed every pair of names compared in code.
 */
export function groupTitles(titles: ParsedTitle[], tmdbIds: (string | null)[] = []): number[][] {
  return titleGroups(titles, tmdbIds).map((group) => group.members);
}

/**
 * `groupTitles`, with what each group adds to its title's id (D-156): two titles of one name and year would otherwise
 * get the same id. The group of the key's smallest TMDB id (by text, the one that took the whole key before) adds
 * nothing, so its id stays; another TMDB id adds itself, and the titles without one in a key with several add "-".
 */
export function titleGroups(titles: ParsedTitle[], tmdbIds: (string | null)[] = []): { members: number[]; idSuffix: string }[] {
  const keys = titles.map(compactKey);
  const years = new Map<string, number | null>();
  titles.forEach((title, index) => {
    if (title.year === null) return;
    const key = keys[index]!;
    const known = years.get(key);
    // null: several years.
    if (known === undefined) years.set(key, title.year);
    else if (known !== title.year) years.set(key, null);
  });
  const groupYears = titles.map((title, index) => title.year ?? years.get(keys[index]!) ?? null);
  const nameKeys = keys.map((key, index) => `${key}|${groupYears[index] ?? ''}`);
  // The smallest TMDB id of each key, and whether it has others.
  const tmdbOfKey = new Map<string, { lowest: string; several: boolean }>();
  nameKeys.forEach((key, index) => {
    const id = tmdbIds[index];
    if (!id) return;
    const known = tmdbOfKey.get(key);
    if (known === undefined) tmdbOfKey.set(key, { lowest: id, several: false });
    else if (known.lowest !== id) tmdbOfKey.set(key, { lowest: id < known.lowest ? id : known.lowest, several: true });
  });
  const groups = new Map<string, { members: number[]; idSuffix: string }>();
  nameKeys.forEach((key, index) => {
    const ofKey = tmdbOfKey.get(key);
    const id = tmdbIds[index] || (ofKey && !ofKey.several ? ofKey.lowest : null);
    const idSuffix = id ? (id > ofKey!.lowest ? id : '') : ofKey ? '-' : '';
    const groupKey = id ? `t${id}|${groupYears[index] ?? ''}` : `k${key}`;
    const group = groups.get(groupKey);
    if (!group) groups.set(groupKey, { members: [index], idSuffix });
    else {
      group.members.push(index);
      if (idSuffix > group.idSuffix) group.idSuffix = idSuffix;
    }
  });
  return [...groups.values()];
}
