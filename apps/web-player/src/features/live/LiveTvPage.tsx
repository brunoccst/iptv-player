import { LiveScreen } from '@iptv/screens';
import '../browse/screenHost';

/** Live TV guide: the screen shared with the TV app (DECISIONS.md#d-201): categories, a 3-hour channel × time grid and programme details (D-032). */
export function LiveTvPage() {
  return <LiveScreen />;
}
