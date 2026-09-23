import { View } from 'react-native';
import { downloadIdFor, type PlayTarget } from '@iptv/shared';
import { downloadsStore } from '../appContext';
import { downloadTargetFrom, selectDownload } from '../downloads/downloadsStore';
import { useDownloads } from '../hooks';
import { FocusButton } from './FocusButton';
import { ProgressRing } from './ProgressRing';

/** "Download for Offline" with a progress circle. Select toggles start / pause / resume. */
export function DownloadButton({ target }: { target: PlayTarget }) {
  const record = useDownloads((s) => (target.kind === 'live' ? null : selectDownload(s, target.kind, target.streamId)));
  const error = useDownloads((s) => (record ? null : s.errors[downloadIdFor(target.kind as 'movie' | 'episode', target.streamId)] ?? null));
  const downloadTarget = downloadTargetFrom(target);
  if (!downloadTarget) return null;

  const { start, pause, resume } = downloadsStore.getState();
  const state = record?.state;
  const percent = Math.round((record?.progress ?? 0) * 100);
  const label =
    state === 'completed' ? 'Downloaded'
    : state === 'downloading' || state === 'queued' ? `Downloading ${percent}%`
    : state === 'paused' ? `Paused ${percent}%`
    : state === 'failed' || error ? 'Download failed · Retry'
    : 'Download';

  const onPress = () => {
    if (!record || state === 'failed') void start(downloadTarget);
    else if (state === 'downloading' || state === 'queued') pause(record.id);
    else if (state === 'paused') resume(record.id);
  };

  const ring = state === 'downloading' || state === 'queued' || state === 'paused'
    ? <View><ProgressRing value={record?.progress ?? 0} size={22} /></View>
    : null;

  return (
    <FocusButton label={label} icon={ring} onPress={onPress} disabled={state === 'completed'} testID="download-button"
      accessibilityLabel={`${label}: ${target.title}`} />
  );
}
