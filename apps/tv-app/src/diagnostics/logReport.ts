import { Platform } from 'react-native';
import { appLog } from '@iptv/shared';
import { appConfig } from '../config';

/** This device's log as shared: a short header, then the newest lines, masked (D-039, D-173). */
export function logReport(): string {
  // Newest lines only: share targets cut long texts off at the end, which lost the lines that mattered.
  const { text, lines, omitted } = appLog.shareText();
  return [
    `${appConfig.appName} diagnostics log (${Platform.isTV ? 'TV' : 'phone'})`,
    `Shared ${new Date().toISOString()} · Android ${Platform.Version}`,
    `${lines} newest lines${omitted ? `, ${omitted} older left out` : ''}; repeats folded (server, accounts and keys masked)`,
    '',
    text,
  ].join('\n');
}
