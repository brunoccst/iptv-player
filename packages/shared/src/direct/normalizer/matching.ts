import { compactKey, type ParsedTitle } from './parser';

/**
 * Groups parsed titles that refer to the same work (D-017, D-133). The same rules as the library database's query
 * (`sqlLibrary`), which groups the titles there; this one serves the library kept in memory (no database):
 *
 * 1. Same compact key and year ("Spider-Man" == "Spiderman"). A year-less title takes the year of its key when the key
 *    has exactly one (dated titles of it); with several it stays apart.
 * 2. Keys that share a TMDB id (D-065) join when their years are the same: each key takes the smallest TMDB id among
 *    its titles, and titles group by that id and year instead of the key.
 *
 * Similar spellings ("Redemtion") no longer join (D-133): that step needed every pair of names compared in code.
 */
export function groupTitles(titles: ParsedTitle[], tmdbIds: (string | null)[] = []): number[][] {
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
  const tmdbOfKey = new Map<string, string>();
  nameKeys.forEach((key, index) => {
    const id = tmdbIds[index];
    if (!id) return;
    const known = tmdbOfKey.get(key);
    if (known === undefined || id < known) tmdbOfKey.set(key, id);
  });
  const groups = new Map<string, number[]>();
  nameKeys.forEach((key, index) => {
    const id = tmdbOfKey.get(key);
    const groupKey = id === undefined ? `k${key}` : `t${id}|${groupYears[index] ?? ''}`;
    const group = groups.get(groupKey);
    if (group) group.push(index);
    else groups.set(groupKey, [index]);
  });
  return [...groups.values()];
}
