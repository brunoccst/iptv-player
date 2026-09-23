import { MEDIA_CACHE_NAME, OFFLINE_PREFIX, partPath, posterPath } from './types';

/** Encrypted chunk storage. Production: Cache API. Tests: in-memory. */
export interface ChunkStore {
  put(id: string, index: number, data: ArrayBuffer): Promise<void>;
  get(id: string, index: number): Promise<ArrayBuffer | null>;
  has(id: string, index: number): Promise<boolean>;
  putPoster(id: string, response: Response): Promise<void>;
  getPoster(id: string): Promise<Response | null>;
  removeAll(id: string): Promise<void>;
}

export function createCacheChunkStore(cacheStorage: CacheStorage, origin: string): ChunkStore {
  const url = (path: string) => new URL(path, origin).href;
  const cache = () => cacheStorage.open(MEDIA_CACHE_NAME);

  return {
    async put(id, index, data) {
      await (await cache()).put(url(partPath(id, index)), new Response(data, { headers: { 'Content-Type': 'application/octet-stream' } }));
    },
    async get(id, index) {
      const response = await (await cache()).match(url(partPath(id, index)));
      return response ? response.arrayBuffer() : null;
    },
    async has(id, index) {
      return (await (await cache()).match(url(partPath(id, index)))) !== undefined;
    },
    async putPoster(id, response) {
      await (await cache()).put(url(posterPath(id)), response);
    },
    async getPoster(id) {
      return (await (await cache()).match(url(posterPath(id)))) ?? null;
    },
    async removeAll(id) {
      const opened = await cache();
      const prefix = url(`${OFFLINE_PREFIX}${id}/`);
      await Promise.all((await opened.keys()).filter((request) => request.url.startsWith(prefix)).map((request) => opened.delete(request)));
    },
  };
}

export function createMemoryChunkStore(): ChunkStore & { parts: Map<string, ArrayBuffer> } {
  const parts = new Map<string, ArrayBuffer>();
  const posters = new Map<string, Response>();
  return {
    parts,
    put: async (id, index, data) => void parts.set(partPath(id, index), data),
    get: async (id, index) => parts.get(partPath(id, index)) ?? null,
    has: async (id, index) => parts.has(partPath(id, index)),
    putPoster: async (id, response) => void posters.set(id, response),
    getPoster: async (id) => posters.get(id)?.clone() ?? null,
    removeAll: async (id) => {
      for (const key of [...parts.keys()]) if (key.startsWith(`${OFFLINE_PREFIX}${id}/`)) parts.delete(key);
      posters.delete(id);
    },
  };
}
