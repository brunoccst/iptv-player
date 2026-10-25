import type { CatchupWindow } from '../playback/catchup';
import type {
  AccountDto,
  CatalogSection,
  EpgGrid,
  LibraryPage,
  LibrarySection,
  LibrarySort,
  LibraryStatus,
  LiveChannel,
  ProgrammeMatch,
  LoginRequest,
  LoginResponse,
  MasterDetails,
  MediaCategory,
  MovieDetails,
  MovieSummary,
  PlaybackInfo,
  PlaybackKind,
  ProfileDto,
  ProfileRequest,
  ProgressDto,
  ProgressKind,
  ProgressRequest,
  SeriesDetails,
  SeriesSummary,
  SortOrder,
  WatchlistDto,
  WatchlistLowSource,
  WatchlistRequest,
} from './types';

/** Omitted `sort` = `added`; omitted `order` = `desc` for dates, `asc` for titles (D-049). */
/** A split or merge by hand (issue #243). */
export type RegroupChange = { action: 'split'; streamId: string } | { action: 'merge'; fromId: string } | { action: 'undo' };

export interface LibraryListQuery {
  categoryId?: string | null;
  search?: string | null;
  offset?: number;
  limit?: number;
  sort?: LibrarySort;
  order?: SortOrder;
  /** Only titles in these categories (Kids profiles, D-053). An empty list is not sent: callers handle "nothing allowed". */
  categoryIds?: string[] | null;
  /** Only titles with a version in one of these audio or subtitle languages, e.g. `ENG` or `ENG,GER` (D-063). */
  language?: string | null;
  /**
   * With `language`: a version whose name has no language passes when it is in one of these categories (named in a
   * chosen language, or in none), D-063.
   */
  languageCategoryIds?: string[] | null;
  /** Leaves out titles whose every version is in one of these categories (hidden by the profile, D-110). */
  hiddenCategoryIds?: string[] | null;
}

/** Categories and channels the profile hid are left out (D-110), except with `includeHidden` (search, the settings). */
export interface CatalogOptions {
  includeHidden?: boolean;
  /** Live channels only: those whose name contains this text, any case (search, D-121). */
  search?: string;
  /** Live channels only: at most this many. */
  limit?: number;
}

/** `from` is an ISO timestamp; default: the current half hour. */
export interface EpgGridQuery {
  categoryId?: string | null;
  from?: string | null;
  hours?: number;
  offset?: number;
  limit?: number;
  /** Only channels in these categories (Kids profiles, D-053). An empty list is not sent: callers handle "nothing allowed". */
  categoryIds?: string[] | null;
  /** Leaves out channels in these categories (hidden by the profile, D-110). */
  hiddenCategoryIds?: string[] | null;
}

/**
 * Everything the apps read and change. `createDirectApiClient` implements it by talking to the IPTV provider and
 * keeping profiles, progress and the grouped library on the device (D-088). Tests use a fake
 * (`testing/fakeBackend.ts`).
 */
export interface ApiClient {
  auth: {
    login(request: LoginRequest): Promise<LoginResponse>;
    logout(): Promise<void>;
    me(signal?: AbortSignal): Promise<AccountDto>;
    /** The saved provider sign-in, password included, for the account menu's IPTV account dialog. */
    credentials(): Promise<LoginRequest>;
    /** Checks a new server, username or password with the provider and saves it, keeping the account's data. */
    updateCredentials(request: LoginRequest): Promise<AccountDto>;
  };
  profiles: {
    list(signal?: AbortSignal): Promise<ProfileDto[]>;
    create(request: ProfileRequest): Promise<ProfileDto>;
    update(profileId: string, request: ProfileRequest): Promise<ProfileDto>;
    remove(profileId: string): Promise<void>;
  };
  progress: {
    list(profileId: string, limit?: number, signal?: AbortSignal): Promise<ProgressDto[]>;
    save(profileId: string, kind: ProgressKind, itemId: string, request: ProgressRequest): Promise<ProgressDto>;
    remove(profileId: string, kind: ProgressKind, itemId: string): Promise<void>;
  };
  /** "My List" per profile (D-055). */
  watchlist: {
    list(profileId: string, signal?: AbortSignal): Promise<WatchlistDto[]>;
    add(profileId: string, section: LibrarySection, masterId: string, request: WatchlistRequest): Promise<WatchlistDto>;
    remove(profileId: string, section: LibrarySection, masterId: string): Promise<void>;
    /** Remembers or forgets the cinema copy entries were seen as (DECISIONS.md#d-176). */
    noteLowSources(profileId: string, marks: WatchlistLowSource[]): Promise<void>;
  };
  catalog: {
    categories(section: CatalogSection, signal?: AbortSignal, options?: CatalogOptions): Promise<MediaCategory[]>;
    liveChannels(categoryId?: string | null, signal?: AbortSignal, options?: CatalogOptions): Promise<LiveChannel[]>;
    /**
     * Programmes of the full TV guide (now and the next two days) whose title contains `search`, on the channels that show
     * them, on now first (issue #119). Empty until the guide is saved; absent where there is no full guide.
     */
    searchProgrammes?(search: string, options?: { limit?: number }, signal?: AbortSignal): Promise<ProgrammeMatch[]>;
    movies(categoryId?: string | null, signal?: AbortSignal): Promise<MovieSummary[]>;
    movie(movieId: string, signal?: AbortSignal): Promise<MovieDetails>;
    series(categoryId?: string | null, signal?: AbortSignal): Promise<SeriesSummary[]>;
    seriesDetails(seriesId: string, signal?: AbortSignal): Promise<SeriesDetails>;
  };
  library: {
    /** Reads the provider's catalog again and regroups it. */
    sync(): Promise<void>;
    status(signal?: AbortSignal): Promise<LibraryStatus[]>;
    list(section: LibrarySection, query?: LibraryListQuery, signal?: AbortSignal): Promise<LibraryPage>;
    get(section: LibrarySection, masterId: string, signal?: AbortSignal): Promise<MasterDetails>;
    /**
     * Splits or merges titles by hand (issue #243), kept as rules the grouping applies on this device, and groups the
     * library again: `split` makes the version `streamId` a title of its own, `merge` puts the title `fromId` into this
     * one, `undo` takes this title's merges or split back. Resolves with the id of the title the rest of this one is
     * in afterwards. Absent where titles cannot be split or merged.
     */
    regroup?(section: LibrarySection, masterId: string, change: RegroupChange): Promise<string>;
  };
  epg: {
    grid(query?: EpgGridQuery, signal?: AbortSignal): Promise<EpgGrid>;
    refresh(): Promise<void>;
    /**
     * The description of a channel's programme starting at `start` (ISO), from the provider's guide for that channel:
     * programmes filled in from the full guide carry none (issue #248). Null when the provider has none.
     */
    description?(channelId: string, start: string, signal?: AbortSignal): Promise<string | null>;
  };
  playback: {
    /** `options.catchup`: a live channel's past programme from the provider's recordings (issue #226). */
    get(
      kind: PlaybackKind,
      id: string,
      container?: string | null,
      signal?: AbortSignal,
      options?: { catchup?: CatchupWindow | null },
    ): Promise<PlaybackInfo>;
    /** Streams the account has in use and may have (issue #242); null where not reported. Absent without a provider. */
    connections?(signal?: AbortSignal): Promise<{ active: number | null; max: number | null }>;
  };
}
