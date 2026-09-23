import type { components, operations } from './generated/schema';

type Schemas = components['schemas'];

export type AccountDto = Schemas['AccountDto'];
export type EpgChannelRow = Schemas['EpgChannelRow'];
export type EpgGrid = Schemas['EpgGrid'];
export type EpgListing = Schemas['EpgListing'];
export type EpgStatus = Schemas['EpgStatus'];
export type Episode = Schemas['Episode'];
export type HealthResponse = Schemas['HealthResponse'];
export type LibraryPage = Schemas['LibraryPage'];
export type LibraryStatus = Schemas['LibraryStatus'];
export type LiveChannel = Schemas['LiveChannel'];
export type LoginRequest = Schemas['LoginRequest'];
export type LoginResponse = Schemas['LoginResponse'];
export type MasterCard = Schemas['MasterCard'];
export type MasterDetails = Schemas['MasterDetails'];
export type MediaCategory = Schemas['MediaCategory'];
export type MediaKind = Schemas['MediaKind'];
export type MovieDetails = Schemas['MovieDetails'];
export type MovieSummary = Schemas['MovieSummary'];
export type PlaybackInfo = Schemas['PlaybackInfo'];
export type ProfileDto = Schemas['ProfileDto'];
export type ProfileRequest = Schemas['ProfileRequest'];
export type ProgressDto = Schemas['ProgressDto'];
export type ProgressRequest = Schemas['ProgressRequest'];
export type Season = Schemas['Season'];
export type SeriesDetails = Schemas['SeriesDetails'];
export type SeriesSummary = Schemas['SeriesSummary'];
export type VariantInfo = Schemas['VariantInfo'];

/** Route segment for catalog and library endpoints. */
export type CatalogSection = 'live' | 'movies' | 'series';
export type LibrarySection = 'movies' | 'series';
export type PlaybackKind = 'live' | 'movie' | 'episode';
export type ProgressKind = 'movie' | 'episode';

/** `code` values the backend puts in problem responses (see backend/README.md#endpoints), plus client-side codes. */
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

/** RFC 9457 problem body. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
}

/** JSON body of a successful response for an OpenAPI operation. */
export type OperationResult<
  Op extends keyof operations,
  Status extends keyof operations[Op]['responses'] = 200 extends keyof operations[Op]['responses'] ? 200 : never,
> = operations[Op]['responses'][Status] extends { content: { 'application/json': infer Body } } ? Body : undefined;
