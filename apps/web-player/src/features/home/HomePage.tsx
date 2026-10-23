import type { ReactNode } from 'react';
import { HomeScreen } from '@iptv/screens';
import { useUi } from '../../hooks/stores';
import '../browse/screenHost';

/**
 * Home: the screen shared with the TV app (DECISIONS.md#d-197), with the library banner above the rows. The first page
 * after sign-in, so it comes with the app instead of loading on its own like the other shared pages. Every row loads
 * again after a library update.
 */
export function HomePage({ banner }: { banner: ReactNode }) {
  const revision = useUi((s) => s.libraryRevision);
  return <HomeScreen key={revision} banner={banner} />;
}
