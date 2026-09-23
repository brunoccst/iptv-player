import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/apiClient';
import type { ApiError } from '../api/httpClient';
import type { PlaybackInfo, PlaybackKind } from '../api/types';
import { toApiError } from './resource';

/** What the user asked to play. `masterId` links library variants back to their master card. */
export interface PlaybackRequest {
  kind: PlaybackKind;
  id: string;
  container?: string | null;
  title?: string;
  masterId?: string;
}

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PlayerState {
  request: PlaybackRequest | null;
  playback: PlaybackInfo | null;
  status: PlayerStatus;
  error: ApiError | null;
  /** Resolves the stream URL. Newer calls win over slower older ones. */
  open(request: PlaybackRequest): Promise<PlaybackInfo | null>;
  close(): void;
}

export function createPlayerStore({ api }: { api: ApiClient }) {
  let generation = 0;

  return createStore<PlayerState>()((set) => ({
    request: null,
    playback: null,
    status: 'idle',
    error: null,

    async open(request) {
      const current = ++generation;
      set({ request, playback: null, status: 'loading', error: null });
      try {
        const playback = await api.playback.get(request.kind, request.id, request.container);
        if (current !== generation) return null;
        set({ playback, status: 'ready' });
        return playback;
      } catch (error) {
        if (current !== generation) return null;
        set({ status: 'error', error: toApiError(error) });
        return null;
      }
    },

    close() {
      generation++;
      set({ request: null, playback: null, status: 'idle', error: null });
    },
  }));
}

export type PlayerStore = ReturnType<typeof createPlayerStore>;
