import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '../api/apiClient';
import type { ApiError } from '../api/httpClient';
import type { AccountDto, LoginRequest, ProfileDto, ProfileRequest } from '../api/types';
import { toApiError } from './resource';
import type { KeyValueStorage } from './storage';

export const SESSION_STORAGE_KEY = 'session';

export type SessionStatus = 'idle' | 'restoring' | 'anonymous' | 'authenticated';

/** Persisted snapshot. Account + profiles are cached so the app can start offline. */
interface PersistedSession {
  token: string;
  account: AccountDto;
  profiles: ProfileDto[];
  activeProfileId: string | null;
}

export interface SessionState {
  status: SessionStatus;
  token: string | null;
  account: AccountDto | null;
  profiles: ProfileDto[];
  activeProfileId: string | null;
  /** True while login or a profile mutation is running. */
  busy: boolean;
  error: ApiError | null;
  /** True when restore could not reach the backend and cached data is shown. */
  offline: boolean;

  restore(): Promise<void>;
  login(request: LoginRequest): Promise<boolean>;
  logout(): Promise<void>;
  /** Clears the session locally after the backend answered 401. */
  handleUnauthorized(): void;
  selectProfile(profileId: string | null): void;
  refreshProfiles(): Promise<void>;
  createProfile(request: ProfileRequest): Promise<ProfileDto | null>;
  updateProfile(profileId: string, request: ProfileRequest): Promise<ProfileDto | null>;
  deleteProfile(profileId: string): Promise<boolean>;
  clearError(): void;
}

const signedOut = (): Pick<SessionState, 'token' | 'account' | 'profiles' | 'activeProfileId' | 'offline'> => ({
  token: null,
  account: null,
  profiles: [],
  activeProfileId: null,
  offline: false,
});

export function createSessionStore({ api, storage }: { api: ApiClient; storage: KeyValueStorage }) {
  const store = createStore<SessionState>()((set, get) => {
    const persist = async () => {
      const { token, account, profiles, activeProfileId } = get();
      if (token && account) {
        const snapshot: PersistedSession = { token, account, profiles, activeProfileId };
        await storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
      } else {
        await storage.removeItem(SESSION_STORAGE_KEY);
      }
    };

    const mutateProfiles = async <T>(action: () => Promise<T>): Promise<T | null> => {
      set({ busy: true, error: null });
      try {
        const result = await action();
        set({ busy: false });
        return result;
      } catch (error) {
        set({ busy: false, error: toApiError(error) });
        return null;
      }
    };

    return {
      status: 'idle',
      ...signedOut(),
      busy: false,
      error: null,

      async restore() {
        set({ status: 'restoring', error: null });
        const snapshot = parseSnapshot(await storage.getItem(SESSION_STORAGE_KEY));
        if (!snapshot) {
          set({ status: 'anonymous', ...signedOut() });
          return;
        }

        set({ ...snapshot, offline: false });
        try {
          const [account, profiles] = await Promise.all([api.auth.me(), api.profiles.list()]);
          const activeProfileId = profiles.some((p) => p.id === snapshot.activeProfileId) ? snapshot.activeProfileId : null;
          set({ status: 'authenticated', account, profiles, activeProfileId });
          await persist();
        } catch (error) {
          const apiError = toApiError(error);
          if (apiError.status === 401) {
            // handleUnauthorized already cleared state via the HTTP client hook; make sure storage is clean too.
            set({ status: 'anonymous', ...signedOut(), error: apiError });
            await storage.removeItem(SESSION_STORAGE_KEY);
          } else {
            set({ status: 'authenticated', offline: true, error: apiError });
          }
        }
      },

      async login(request) {
        set({ busy: true, error: null });
        try {
          const response = await api.auth.login(request);
          const activeProfileId = response.profiles.length === 1 ? response.profiles[0]!.id : null;
          set({
            status: 'authenticated',
            token: response.token,
            account: response.account,
            profiles: response.profiles,
            activeProfileId,
            offline: false,
            busy: false,
          });
          await persist();
          return true;
        } catch (error) {
          set({ busy: false, error: toApiError(error) });
          return false;
        }
      },

      async logout() {
        if (get().token) {
          await api.auth.logout().catch(() => undefined); // best effort: local sign-out must always succeed
        }
        set({ status: 'anonymous', ...signedOut(), error: null });
        await persist();
      },

      handleUnauthorized() {
        if (get().status === 'anonymous') return;
        set({ status: 'anonymous', ...signedOut() });
        void storage.removeItem(SESSION_STORAGE_KEY);
      },

      selectProfile(profileId) {
        if (profileId !== null && !get().profiles.some((profile) => profile.id === profileId)) return;
        set({ activeProfileId: profileId });
        void persist();
      },

      async refreshProfiles() {
        await mutateProfiles(async () => {
          const profiles = await api.profiles.list();
          const { activeProfileId } = get();
          set({ profiles, activeProfileId: profiles.some((p) => p.id === activeProfileId) ? activeProfileId : null });
          await persist();
        });
      },

      createProfile: (request) =>
        mutateProfiles(async () => {
          const profile = await api.profiles.create(request);
          set({ profiles: [...get().profiles, profile] });
          await persist();
          return profile;
        }),

      updateProfile: (profileId, request) =>
        mutateProfiles(async () => {
          const profile = await api.profiles.update(profileId, request);
          set({ profiles: get().profiles.map((existing) => (existing.id === profileId ? profile : existing)) });
          await persist();
          return profile;
        }),

      async deleteProfile(profileId) {
        const deleted = await mutateProfiles(async () => {
          await api.profiles.remove(profileId);
          const { profiles, activeProfileId } = get();
          set({
            profiles: profiles.filter((profile) => profile.id !== profileId),
            activeProfileId: activeProfileId === profileId ? null : activeProfileId,
          });
          await persist();
          return true;
        });
        return deleted ?? false;
      },

      clearError: () => set({ error: null }),
    };
  });

  return store;
}

export type SessionStore = ReturnType<typeof createSessionStore>;

export const selectActiveProfile = (state: SessionState): ProfileDto | null =>
  state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null;

function parseSnapshot(raw: string | null): PersistedSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PersistedSession>;
    return value.token && value.account && Array.isArray(value.profiles)
      ? { token: value.token, account: value.account, profiles: value.profiles, activeProfileId: value.activeProfileId ?? null }
      : null;
  } catch {
    return null;
  }
}
