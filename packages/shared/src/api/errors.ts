import type { ApiErrorCode } from './types';

/** A failed call: `status` follows HTTP (0 = no answer), `code` says what went wrong. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | (string & {});
  /** What the provider's own page said, as text, when it sent a page instead of data (DECISIONS.md#d-230). */
  readonly reply: string | null;

  constructor(status: number, code: ApiErrorCode | (string & {}), message: string, reply: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.reply = reply;
  }
}
