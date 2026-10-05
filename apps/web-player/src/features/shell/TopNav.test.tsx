// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const profile = { id: 'p1', name: 'Bruno', isKids: false };
const state = { view: 'home', search: '', profiles: [profile], activeProfileId: 'p1', status: 'none' };
vi.mock('../../config', () => ({ appConfig: { appName: 'Player', appSlug: 'player' } }));
vi.mock('../../appContext', () => ({
  downloadsStore: { getState: () => ({ records: {} }) },
  signOut: vi.fn(),
  stores: { session: { getState: () => ({ selectProfile: vi.fn() }) }, library: { getState: () => ({ sync: vi.fn() }) } },
  uiStore: { getState: () => ({ navigate: vi.fn(), setSearch: vi.fn() }) },
}));
vi.mock('../../hooks/stores', () => ({
  usePin: (select: (s: typeof state) => unknown) => select(state),
  useSession: (select: (s: typeof state) => unknown) => select(state),
  useUi: (select: (s: typeof state) => unknown) => select(state),
}));
vi.mock('@iptv/shared', async (original) => ({
  ...(await original<typeof import('@iptv/shared')>()),
  selectActiveProfile: () => profile,
}));

// The dialogs the menu opens are not under test.
vi.mock('../backup/BackupDialog', () => ({ BackupDialog: () => null }));
vi.mock('./AboutDialog', () => ({ AboutDialog: () => null }));
vi.mock('./AppLanguageDialog', () => ({ AppLanguageDialog: () => null }));
vi.mock('./LogDialog', () => ({ LogDialog: () => null }));
vi.mock('../pairing/SyncWithPhone', () => ({ openSyncWithPhone: vi.fn() }));
vi.mock('../profiles/PinDialog', () => ({ usePinGate: () => ({ gate: vi.fn(), dialog: null }) }));
vi.mock('../profiles/HiddenCategories', () => ({ HiddenCategories: () => null }));
vi.mock('../profiles/LanguageSettings', () => ({ LanguageSettings: () => null }));
vi.mock('../profiles/SubtitleSettings', () => ({ SubtitleSettings: () => null }));
vi.mock('../profiles/PinSettings', () => ({ PinSettings: () => null }));

describe('account menu (issue #155)', () => {
  afterEach(cleanup);

  const open = async () => {
    const { TopNav } = await import('./TopNav');
    render(<TopNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    return screen.getByRole('menu');
  };

  it('stays open when the mouse leaves it, and in a group', async () => {
    const menu = await open();
    fireEvent.mouseLeave(menu);
    fireEvent.mouseOut(menu);
    fireEvent.click(screen.getByRole('menuitem', { name: /App$/ }));
    expect(screen.getByRole('menu').textContent).toContain('About');
  });

  it('closes on a click elsewhere, not on a click inside', async () => {
    const menu = await open();
    fireEvent.mouseDown(menu);
    expect(screen.queryByRole('menu')).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and gives the focus back to the avatar', async () => {
    await open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Account menu' }));
  });

  it('the avatar still toggles it closed', async () => {
    await open();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
