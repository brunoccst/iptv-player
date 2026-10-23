import { DownloadsScreen } from '@iptv/screens';
import '../browse/screenHost';

/** My Downloads: the screen shared with the TV app (DECISIONS.md#d-198); copies are encrypted in-app, never files. */
export function DownloadsPage() {
  return <DownloadsScreen />;
}
