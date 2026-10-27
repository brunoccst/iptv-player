import { NewSeasonsDialog as SharedNewSeasonsDialog } from '@iptv/screens';
import '../browse/screenHost';

/** "New seasons" of watched series (DECISIONS.md#d-234): the dialog shared with the TV app (DECISIONS.md#d-204), over Home. */
export function NewSeasonsDialog() {
  return <SharedNewSeasonsDialog visible />;
}
