import { BrowseScreen as SharedBrowseScreen } from '@iptv/screens';
import { t, type LibrarySection } from '@iptv/shared';
import { LibraryBanner } from '../components/LibraryBanner';
import '../screenHost';

/** Movies/Series: the screen shared with the desktop app (issue #237, DECISIONS.md#d-195), with the TV's library banner. */
export function BrowseScreen({ section, processing = false }: { section: LibrarySection; processing?: boolean }) {
  return (
    <SharedBrowseScreen
      section={section}
      // First start: the library is still being organized, so the page is empty for now; the banner shows progress.
      emptyText={processing ? t('Your library is being organized. Titles appear here as soon as it is done.') : undefined}
      overlay={<LibraryBanner processing={processing} />}
    />
  );
}
