/**
 * The data the apps work with. The direct client (`direct/directApiClient.ts`) builds it from the provider's answers
 * (D-038); the whole app reads it through `ApiClient`.
 */

export interface AccountDto {
  expiresAt: null | string;
  id: string;
  maxConnections: null | number;
  providerType: string;
  serverUrl: string;
  status: null | string;
  username: string;
}

export interface EpgChannelRow {
  channel: LiveChannel;
  programmes: EpgListing[];
}

export interface EpgGrid {
  channels: EpgChannelRow[];
  from: string;
  status: EpgStatus;
  to: string;
  totalChannels: number;
  updatedAt: null | string;
}

export interface EpgListing {
  description: null | string;
  end: string;
  start: string;
  title: string;
}

export type EpgStatus = 'ready' | 'refreshing' | 'unavailable';

export interface Episode {
  containerExtension: null | string;
  durationSeconds: null | number;
  episodeNumber: null | number;
  id: string;
  plot: null | string;
  seasonNumber: number;
  stillUrl: null | string;
  title: string;
}

export interface LibraryPage {
  items: MasterCard[];
  sorts: LibrarySort[];
  total: number;
}

export type LibrarySort = 'added' | 'title' | 'released';

export interface LibraryStatus {
  error: null | string;
  finishedAt: null | string;
  itemCount: null | number;
  jobStatus: null | string;
  masterCount: number;
  mediaKind: string;
  queuedAt: null | string;
}

export interface LiveChannel {
  categoryId: null | string;
  epgChannelId: null | string;
  hasCatchup: boolean;
  id: string;
  logoUrl: null | string;
  name: string;
  number: null | number;
}

export interface LoginRequest {
  password: string;
  providerType?: null | string;
  serverUrl: string;
  username: string;
}

export interface LoginResponse {
  account: AccountDto;
  expiresAt: string;
  profiles: ProfileDto[];
  token: string;
}

export interface MasterCard {
  bestQuality: null | string;
  id: string;
  posterUrl: null | string;
  rating: null | number;
  title: string;
  variantCount: number;
  year: null | number;
}

export interface MasterDetails {
  bestQuality: null | string;
  id: string;
  posterUrl: null | string;
  rating: null | number;
  title: string;
  variants: VariantInfo[];
  year: null | number;
}

export interface MediaCategory {
  id: string;
  kind: MediaKind;
  name: string;
}

export type MediaKind = 'live' | 'movie' | 'series';

export interface MovieDetails {
  backdropUrls: string[];
  cast: null | string;
  director: null | string;
  durationSeconds: null | number;
  genre: null | string;
  plot: null | string;
  releaseDate: null | string;
  summary: MovieSummary;
  tmdbId: null | string;
  trailerYoutubeId: null | string;
}

export interface MovieSummary {
  addedAt: null | string;
  categoryId: null | string;
  containerExtension: null | string;
  id: string;
  name: string;
  posterUrl: null | string;
  rating: null | number;
  tmdbId: null | string;
}

export interface PlaybackInfo {
  container: string;
  deliveryMode: string;
  isLive: boolean;
  url: string;
}

export interface ProfileDto {
  avatarKey: null | string;
  id: string;
  isKids: boolean;
  name: string;
}

export interface ProfileRequest {
  avatarKey?: null | string;
  isKids: boolean;
  name: string;
}

export interface ProgressDto {
  containerExtension: null | string;
  durationSeconds: number;
  episodeNumber: null | number;
  itemId: string;
  kind: string;
  masterId: null | string;
  positionSeconds: number;
  posterUrl: null | string;
  seasonNumber: null | number;
  seriesId: null | string;
  title: string;
  updatedAt: string;
}

export interface ProgressRequest {
  containerExtension?: null | string;
  durationSeconds: number;
  episodeNumber?: null | number;
  masterId?: null | string;
  positionSeconds: number;
  posterUrl?: null | string;
  seasonNumber?: null | number;
  seriesId?: null | string;
  title: string;
}

export interface Season {
  coverUrl: null | string;
  episodes: Episode[];
  name: string;
  number: number;
}

export interface SeriesDetails {
  backdropUrls: string[];
  cast: null | string;
  director: null | string;
  seasons: Season[];
  summary: SeriesSummary;
  trailerYoutubeId: null | string;
}

export interface SeriesSummary {
  categoryId: null | string;
  genre: null | string;
  id: string;
  lastModifiedAt: null | string;
  name: string;
  plot: null | string;
  posterUrl: null | string;
  rating: null | number;
  releaseDate: null | string;
  tmdbId: null | string;
}

export interface VariantInfo {
  audioLanguages: string[];
  audioTag: null | string;
  categoryId: null | string;
  containerExtension: null | string;
  isHdr: boolean;
  label: string;
  quality: null | string;
  rawTitle: string;
  source: null | string;
  streamId: string;
  subtitleLanguages: string[];
}

export interface WatchlistDto {
  addedAt: string;
  masterId: string;
  posterUrl: null | string;
  section: LibrarySection;
  title: string;
  year: null | number;
}

export interface WatchlistRequest {
  posterUrl?: null | string;
  title: string;
  year?: null | number;
}

/** Client-side extension of LibraryStatus: the stage and how many titles have been read (D-038). */
/** `waiting`: downloaded, waiting for the other kind to finish grouping (D-093). */
export type LibraryStage = 'downloading' | 'waiting' | 'grouping';
/** What an update changed against the last library (D-119); none on a first build. */
export interface LibraryChanges {
  added: number;
  changed: number;
  removed: number;
}

export type LibraryStatusProgress = LibraryStatus & {
  stage?: LibraryStage | null;
  parsedCount?: number | null;
  changes?: LibraryChanges | null;
};
/** The same stream on the provider's announced stream server (D-038). */
export type PlaybackInfoWithAlternates = PlaybackInfo & { alternateUrls?: string[] };
export type SortOrder = 'asc' | 'desc';

/** Sections of the provider's catalog and of the grouped library. */
export type CatalogSection = 'live' | 'movies' | 'series';
export type LibrarySection = 'movies' | 'series';
export type PlaybackKind = 'live' | 'movie' | 'episode';
export type ProgressKind = 'movie' | 'episode';

/** Error codes the app uses (`ApiError.code`). */
export type ApiErrorCode =
  | 'validation_failed'
  | 'invalid_provider_credentials'
  | 'provider_credentials_rejected'
  | 'provider_unavailable'
  | 'unauthorized'
  | 'not_found'
  | 'network_error'
  | 'timeout'
  | 'aborted'
  | 'http_error';
