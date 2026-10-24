// Shared with the desktop app (issue #237, DECISIONS.md#d-207).
import '../screenHost';
import { AccountMenu as SharedAccountMenu } from '@iptv/screens';
import { navStore } from '../appContext';
import { useNav } from '../hooks';

const setGroup = (group: string | null) => navStore.getState().setMenuGroup(group);
const close = () => navStore.getState().setMenuOpen(false);

/** The account menu under the nav avatar; open and its group live in the nav store, so Back leaves a group first. */
export function AccountMenu() {
  const open = useNav((s) => s.menuOpen);
  const group = useNav((s) => s.menuGroup);
  return <SharedAccountMenu open={open} group={group} onGroup={setGroup} onClose={close} />;
}
