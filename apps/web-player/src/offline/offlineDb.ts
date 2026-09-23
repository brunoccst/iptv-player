import type { DownloadRecord } from './types';

const DB_NAME = 'offline';
const DB_VERSION = 1;

export interface OfflineDb {
  listDownloads(): Promise<DownloadRecord[]>;
  getDownload(id: string): Promise<DownloadRecord | null>;
  putDownload(record: DownloadRecord): Promise<void>;
  deleteDownload(id: string): Promise<void>;
  getKey(id: string): Promise<CryptoKey | null>;
  putKey(id: string, key: CryptoKey): Promise<void>;
  deleteKey(id: string): Promise<void>;
}

/** Minimal promise wrapper over IndexedDB. Stores: `downloads` (records), `keys` ({ id, key: CryptoKey }). */
export function createOfflineDb(factory: IDBFactory | undefined = globalThis.indexedDB): OfflineDb {
  let opening: Promise<IDBDatabase> | null = null;

  const open = () =>
    (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (!factory) return reject(new Error('IndexedDB is not available.'));
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('downloads', { keyPath: 'id' });
        request.result.createObjectStore('keys', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));

  async function run<T>(store: string, mode: IDBTransactionMode, action: (objects: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = action(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  return {
    listDownloads: () => run<DownloadRecord[]>('downloads', 'readonly', (s) => s.getAll()),
    getDownload: async (id) => (await run<DownloadRecord | undefined>('downloads', 'readonly', (s) => s.get(id))) ?? null,
    putDownload: async (record) => void (await run('downloads', 'readwrite', (s) => s.put(record))),
    deleteDownload: async (id) => void (await run('downloads', 'readwrite', (s) => s.delete(id))),
    getKey: async (id) => (await run<{ key: CryptoKey } | undefined>('keys', 'readonly', (s) => s.get(id)))?.key ?? null,
    putKey: async (id, key) => void (await run('keys', 'readwrite', (s) => s.put({ id, key }))),
    deleteKey: async (id) => void (await run('keys', 'readwrite', (s) => s.delete(id))),
  };
}
