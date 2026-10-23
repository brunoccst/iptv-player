import type { ReactNode } from 'react';
import { BrowseScreen } from '@iptv/screens';
import type { LibrarySection } from '@iptv/shared';
import { useUi } from '../../hooks/stores';
import './screenHost';

/** Movies or Series: the screen shared with the TV app (DECISIONS.md#d-195), with the library banner under the title. */
export function BrowsePage({ section, banner }: { section: LibrarySection; banner: ReactNode }) {
  const revision = useUi((s) => s.libraryRevision);
  return <BrowseScreen key={`${section}-${revision}`} section={section} banner={banner} />;
}
