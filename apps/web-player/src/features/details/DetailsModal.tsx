import { DetailsScreen } from '@iptv/screens';
import type { DetailsTarget } from '../../ui/uiStore';
import '../browse/screenHost';

/** A title's details: the screen shared with the TV app (DECISIONS.md#d-202), in the app's dialog over the page. */
export function DetailsModal({ target }: { target: DetailsTarget }) {
  return <DetailsScreen section={target.section} masterId={target.masterId} />;
}
