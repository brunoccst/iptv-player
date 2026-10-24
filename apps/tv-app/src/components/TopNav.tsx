// Shared with the desktop app (issue #237, DECISIONS.md#d-208).
import '../screenHost';
import { TopNav as SharedTopNav, type NavSection } from '@iptv/screens';
import { navStore } from '../appContext';
import { useNav } from '../hooks';
import { currentSection } from '../navigation/navStore';

export { useNavFocusTarget } from '@iptv/screens';

const nav = () => navStore.getState();
const goSection = (section: NavSection) => nav().goSection(section);
const setSearch = (text: string) => nav().setSearch(text);
const submitSearch = () => nav().submitSearch();
const setMenuOpen = (open: boolean) => nav().setMenuOpen(open);
const searchOpened = () => nav().searchOpened();

/** The top nav over every page; its page, search text and menu live in the nav store. */
export function TopNav() {
  const section = useNav(currentSection);
  const search = useNav((s) => s.search);
  const scrolled = useNav((s) => s.scrolled);
  const menuOpen = useNav((s) => s.menuOpen);
  const searchRequested = useNav((s) => s.searchRequested);
  return (
    <SharedTopNav
      section={section}
      search={search}
      solid={scrolled || section !== 'home'}
      menuOpen={menuOpen}
      onSection={goSection}
      onSearch={setSearch}
      onSubmitSearch={submitSearch}
      onMenu={setMenuOpen}
      searchRequested={searchRequested}
      onSearchOpened={searchOpened}
    />
  );
}
