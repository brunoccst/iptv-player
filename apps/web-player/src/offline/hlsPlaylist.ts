/** HLS helpers for offline downloads: pick a rendition, list every resource, build a local playlist. */

export interface Variant {
  url: string;
  bandwidth: number;
}

const URI_ATTRIBUTE = /URI="([^"]+)"/g;

export const isMasterPlaylist = (text: string) => text.includes('#EXT-X-STREAM-INF');

/** Highest-bandwidth rendition of a master playlist. */
export function pickBestVariant(text: string, baseUrl: string): Variant | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  let best: Variant | null = null;
  lines.forEach((line, index) => {
    if (!line.startsWith('#EXT-X-STREAM-INF')) return;
    const uri = lines.slice(index + 1).find((next) => next && !next.startsWith('#'));
    if (!uri) return;
    const bandwidth = Number(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? 0);
    if (!best || bandwidth > best.bandwidth) best = { url: new URL(uri, baseUrl).href, bandwidth };
  });
  return best;
}

export interface OfflinePlaylist {
  /** Playlist text with every URI replaced by `localUri(index)`. */
  playlist: string;
  /** Absolute upstream URL per resource index (segments, init maps, keys). */
  resources: string[];
}

export class LivePlaylistError extends Error {
  constructor() {
    super('Live streams cannot be downloaded.');
    this.name = 'LivePlaylistError';
  }
}

export function prepareOfflinePlaylist(text: string, baseUrl: string, localUri: (index: number) => string): OfflinePlaylist {
  if (!text.includes('#EXT-X-ENDLIST')) throw new LivePlaylistError();

  const resources: string[] = [];
  const indexOf = new Map<string, number>();
  const register = (uri: string) => {
    const absolute = new URL(uri, baseUrl).href;
    let index = indexOf.get(absolute);
    if (index === undefined) {
      index = resources.push(absolute) - 1;
      indexOf.set(absolute, index);
    }
    return localUri(index);
  };

  const playlist = text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) return line.replace(URI_ATTRIBUTE, (_, uri: string) => `URI="${register(uri)}"`);
      return register(trimmed);
    })
    .join('\n');

  return { playlist, resources };
}
