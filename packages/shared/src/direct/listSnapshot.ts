import type { LibraryListQuery } from '../api/apiClient';
import type { LibraryPage, LibrarySection, MasterDetails } from '../api/types';
import type { KeyValueStorage } from '../stores/storage';
import { appLog, errorMessage } from '../utils/logger';

/** Lists and details kept; more than Home, the first grid pages and their details need. */
const MAX_LISTS = 40;
const MAX_DETAILS = 400;
/** Lists this short (the hero's 30 titles, the rows) also keep their titles' details, so the hero shows at once. */
const DETAILS_UP_TO = 30;
/** Answers are saved this long after the last new one, together. */
const SAVE_DELAY_MS = 3000;

const snapshotKey = (accountId: string) => `direct.snapshot.v1.${accountId}`;

interface SavedSnapshot {
  lists: [string, LibraryPage][];
  details: [string, MasterDetails][];
}

/** Same key for the same list, whatever order the query's fields came in; null for lists that are not kept. */
function listKey(section: LibrarySection, query: LibraryListQuery): string | null {
  if (query.search?.trim() || (query.offset ?? 0) > 0) return null;
  const fields = (Object.keys(query) as (keyof LibraryListQuery)[])
    .filter((field) => field !== 'offset' && field !== 'search' && query[field] !== undefined && query[field] !== null)
    .sort()
    .map((field) => [field, query[field]]);
  return `${section}|${JSON.stringify(fields)}`;
}

const detailsKey = (section: LibrarySection, masterId: string) => `${section}|${masterId}`;

/**
 * The first pages the screens asked for, with the details of short lists, saved apart from the library (D-120). After
 * a start, Home answers from here while the saved library (30+ MB for 160k titles, 15 s on a Chromecast) is still being
 * read. It holds only answers from the saved library as it is now: a kind's answers are dropped before a new library of
 * that kind is saved.
 */
export function createListSnapshot(storage: KeyValueStorage, saveDelayMs = SAVE_DELAY_MS) {
  let accountId: string | null = null;
  let ready: Promise<void> = Promise.resolve();
  const lists = new Map<string, LibraryPage>();
  const details = new Map<string, MasterDetails>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const read = async (id: string) => {
    try {
      const text = await storage.getItem(snapshotKey(id));
      if (!text || accountId !== id) return;
      const saved = JSON.parse(text) as SavedSnapshot;
      // Answers recorded while the file was read are newer: kept.
      for (const [key, page] of saved.lists ?? []) if (!lists.has(key)) lists.set(key, page);
      for (const [key, value] of saved.details ?? []) if (!details.has(key)) details.set(key, value);
    } catch (error) {
      appLog.warn('storage', `${snapshotKey(id)}: read failed: ${errorMessage(error)}`);
    }
  };

  /** Switches to `id`'s answers (read once); true when they are for `id`. */
  const open = (id: string) => {
    if (accountId !== id) {
      if (timer) clearTimeout(timer);
      timer = null;
      accountId = id;
      lists.clear();
      details.clear();
      ready = read(id);
    }
    return ready.then(() => accountId === id);
  };

  const save = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!accountId) return;
    const saved: SavedSnapshot = { lists: [...lists], details: [...details] };
    try {
      await storage.setItem(snapshotKey(accountId), JSON.stringify(saved));
    } catch (error) {
      appLog.warn('storage', `${snapshotKey(accountId)}: write failed: ${errorMessage(error)}`);
    }
  };

  /** Most recent last; the oldest goes past the limit. */
  const keep = <T>(map: Map<string, T>, key: string, value: T, max: number) => {
    map.delete(key);
    map.set(key, value);
    while (map.size > max) map.delete(map.keys().next().value!);
  };

  return {
    async list(id: string, section: LibrarySection, query: LibraryListQuery): Promise<LibraryPage | null> {
      const key = listKey(section, query);
      if (!key || !(await open(id))) return null;
      return lists.get(key) ?? null;
    },

    async details(id: string, section: LibrarySection, masterId: string): Promise<MasterDetails | null> {
      if (!(await open(id))) return null;
      return details.get(detailsKey(section, masterId)) ?? null;
    },

    /** Keeps an answer from the loaded library; `detailsOf` gives a title's details for short lists. */
    record(
      id: string,
      section: LibrarySection,
      query: LibraryListQuery,
      page: LibraryPage,
      detailsOf: (masterId: string) => MasterDetails | null,
    ) {
      const key = listKey(section, query);
      if (!key) return;
      void open(id);
      if (accountId !== id) return;
      const same = JSON.stringify(lists.get(key)) === JSON.stringify(page);
      keep(lists, key, page, MAX_LISTS);
      if ((query.limit ?? 100) <= DETAILS_UP_TO) {
        for (const item of page.items) {
          const value = detailsOf(item.id);
          if (value) keep(details, detailsKey(section, item.id), value, MAX_DETAILS);
        }
      }
      if (!same && !timer) timer = setTimeout(() => void save(), saveDelayMs);
    },

    /** Forgets a section's answers and saves at once: called before a new library of that kind is saved. */
    async drop(id: string, section: LibrarySection) {
      await open(id);
      if (accountId !== id) return;
      for (const key of [...lists.keys()]) if (key.startsWith(`${section}|`)) lists.delete(key);
      for (const key of [...details.keys()]) if (key.startsWith(`${section}|`)) details.delete(key);
      await save();
    },

    /** Signed out: nothing is kept in memory (the file stays, like the library). */
    close() {
      if (timer) clearTimeout(timer);
      timer = null;
      accountId = null;
      ready = Promise.resolve();
      lists.clear();
      details.clear();
    },
  };
}
