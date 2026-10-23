import { QualityUpgradeDialog as SharedQualityUpgradeDialog } from '@iptv/screens';
import '../browse/screenHost';

/** "Better quality on My List" (D-176): the dialog shared with the TV app (DECISIONS.md#d-204), over Home. */
export function QualityUpgradeDialog() {
  return <SharedQualityUpgradeDialog visible />;
}
