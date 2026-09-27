import { t, type ApiError } from '@iptv/shared';

/** User-facing text for an ApiError. Codes: packages/shared/src/api/README.md. */
export function errorText(error: ApiError | null | undefined): string {
  if (!error) return '';
  switch (error.code) {
    case 'invalid_provider_credentials':
      return t('Your IPTV provider rejected this username or password.');
    case 'provider_credentials_rejected':
      return t('Your IPTV provider no longer accepts the saved login. Sign out and sign in again.');
    case 'provider_unavailable':
      return t('Your IPTV provider is not responding. Try again in a moment.');
    case 'validation_failed':
      return error.message;
    case 'network_error':
    case 'timeout':
      return t('Cannot reach the server. Is the backend running?');
    case 'not_found':
      return t('This title is no longer available.');
    default:
      return error.message || t('Something went wrong.');
  }
}
