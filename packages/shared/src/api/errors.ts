import type { ApiErrorCode } from './types';

/** A failed call: `status` follows HTTP (0 = no answer), `code` says what went wrong. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | (string & {});

  constructor(status: number, code: ApiErrorCode | (string & {}), message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
