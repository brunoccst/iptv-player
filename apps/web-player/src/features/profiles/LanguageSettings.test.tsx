// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../appContext', async () => {
  const { createTestAppContext, createFakeBackend } = await import('../../../../../packages/shared/src/testing/fakeBackend');
  const { createMemoryStorage } = await import('@iptv/shared');
  const { stores } = createTestAppContext({
    config: { appName: 'T', appSlug: 't' },
    storage: createMemoryStorage(),
    backend: createFakeBackend(),
  });
  const uiStore = { getState: () => ({ playing: false }) };
  return { api: {}, stores, downloadsStore: uiStore, uiStore };
});

const { LanguageSettings } = await import('./LanguageSettings');

describe('Content language filter: the order is the priority (D-145)', () => {
  afterEach(cleanup);

  it('numbers the ticked languages in the order they were ticked', () => {
    render(<LanguageSettings profile={{ id: 'p1', name: 'Alex' }} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'German' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Portuguese' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'English' }));
    expect(screen.getByRole('checkbox', { name: '1. German' })).toHaveProperty('checked', true);
    expect(screen.getByRole('checkbox', { name: '2. Portuguese' })).toHaveProperty('checked', true);
    expect(screen.getByRole('checkbox', { name: '3. English' })).toHaveProperty('checked', true);
    // Unticking one moves the later ones up.
    fireEvent.click(screen.getByRole('checkbox', { name: '2. Portuguese' }));
    expect(screen.getByRole('checkbox', { name: 'Portuguese' })).toHaveProperty('checked', false);
    expect(screen.getByRole('checkbox', { name: '2. English' })).toHaveProperty('checked', true);
  });
});
