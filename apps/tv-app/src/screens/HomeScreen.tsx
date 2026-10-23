import { HomeScreen as SharedHomeScreen } from '@iptv/screens';
import { LibraryBanner } from '../components/LibraryBanner';
import '../screenHost';

/** Home: the screen shared with the desktop app (issue #237, DECISIONS.md#d-197), with the TV's library banner over it. */
export function HomeScreen({ processing = false }: { processing?: boolean }) {
  // The library notice floats at the bottom, over the rows: under the see-through top nav it was hard to read.
  return <SharedHomeScreen overlay={<LibraryBanner processing={processing} />} />;
}
