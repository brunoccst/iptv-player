import type {
  AccountDto,
  CatalogSection,
  EpgGrid,
  LibraryPage,
  LibrarySection,
  LibrarySort,
  LibraryStatus,
  LiveChannel,
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
  WatchlistRequest,
} from './types';

/** Omitted `sort` = `added`; omitted `order` = `desc` for dates, `asc` for titles (D-049). */
export interface LibraryListQuery {
  categoryId?: string | null;
  search?: string | null;
  offset?: number;
  limit?: number;
  sort?: LibrarySort;
  order?: SortOrder;
  /** Only titles in these categories (Kids profiles, D-053). An empty list is not sent: callers handle "nothing allowed". */
  categoryIds?: string[] | null;
  /** Only titles with a version in one of these audio or subtitle languages, e.g. `ENG` or `ENG,GER` (D-063, D-067). */
  language?: string | null;
  /**
   * With `language`: a version whose name has no language passes when it is in one of these categories (named in a
   * chosen language, or in none), D-086.
   */
  languageCategoryIds?: string[] | null;
  /** Leaves out titles whose every version is in one of these categories (hidden by the profile, D-110). */
  hiddenCategoryIds?: string[] | null;
}

/** Categories and channels the profile hid are left out (D-110), except with `includeHidden` (search, the settings). */
export interface CatalogOptions {
  includeHidden?: boolean;
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
 * keeping profiles, progress and the grouped library on the device (D-038, D-088). Tests use a fake
 * (`testing/fakeBackend.ts`).
 */
export interface ApiClient {
  auth: {
    login(request: LoginRequest): Promise<LoginResponse>;
    logout(): Promise<void>;
    me(signal?: AbortSignal): Promise<AccountDto>;
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
  };
  catalog: {
    categories(section: CatalogSection, signal?: AbortSignal, options?: CatalogOptions): Promise<MediaCategory[]>;
    liveChannels(categoryId?: string | null, signal?: AbortSignal, options?: CatalogOptions): Promise<LiveChannel[]>;
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
  };
  epg: {
    grid(query?: EpgGridQuery, signal?: AbortSignal): Promise<EpgGrid>;
    refresh(): Promise<void>;
  };
  playback: {
    get(kind: PlaybackKind, id: string, container?: string | null, signal?: AbortSignal): Promise<PlaybackInfo>;
  };
}
