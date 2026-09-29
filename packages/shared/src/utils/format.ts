import { intlLocale, t } from '../i18n/i18n'; /** "1h 32m", "45m", "0m". For runtime labels on cards and details. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '';
  const minutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? t('{hours}h {minutes}m', { hours, minutes: rest }) : t('{minutes}m', { minutes: rest });
}

/** "1:02:03" or "2:03". For player timelines. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** "1.4 GB" or "350 MB", in the app language's number format. For download sizes. */
export const formatBytes = (bytes: number) =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toLocaleString(intlLocale(), { maximumFractionDigits: 1 })} GB`
    : `${Math.round(bytes / 1e6).toLocaleString(intlLocale())} MB`;
