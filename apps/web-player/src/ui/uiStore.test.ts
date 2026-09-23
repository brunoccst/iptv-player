import { describe, expect, it } from 'vitest';
import { createUiStore } from './uiStore';

/** In-memory History: enough for push/replace/back semantics. */
function fakeHistory() {
  const entries: unknown[] = [null];
  let index = 0;
  const history = {
    pushState: (state: unknown) => {
      entries.splice(index + 1);
      entries.push(state);
      index++;
    },
    replaceState: (state: unknown) => void (entries[index] = state),
    back: () => {
      index = Math.max(0, index - 1);
    },
    get length() {
      return entries.length;
    },
  };
  return { history: history as unknown as History, entries, current: () => entries[index] };
}

describe('ui store', () => {
  it('pushes navigation, details and playback into history', () => {
    const { history, entries } = fakeHistory();
    const ui = createUiStore(history);

    ui.getState().navigate('movies');
    ui.getState().openDetails({ section: 'movies', masterId: 'm1' });
    ui.getState().play({ kind: 'movie', streamId: '1', container: 'mp4', title: 'A' });

    expect(entries).toHaveLength(4);
    expect(ui.getState()).toMatchObject({ view: 'movies', details: { masterId: 'm1' }, playing: { streamId: '1' } });
  });

  it('replacePlayback swaps the item without a new history entry', () => {
    const { history, entries } = fakeHistory();
    const ui = createUiStore(history);
    ui.getState().play({ kind: 'episode', streamId: 'e1', container: 'mp4', title: 'S' });

    ui.getState().replacePlayback({ kind: 'episode', streamId: 'e2', container: 'mp4', title: 'S' });

    expect(entries).toHaveLength(2);
    expect(ui.getState().playing?.streamId).toBe('e2');
  });

  it('search switches to the search view and back to home when cleared', () => {
    const ui = createUiStore(fakeHistory().history);

    ui.getState().setSearch('matrix');
    expect(ui.getState().view).toBe('search');
    ui.getState().setSearch('');
    expect(ui.getState().view).toBe('home');
  });

  it('without history, close actions reset state directly', () => {
    const ui = createUiStore(null);
    ui.getState().openDetails({ section: 'series', masterId: 's' });
    ui.getState().closeDetails();
    expect(ui.getState().details).toBeNull();
  });
});
