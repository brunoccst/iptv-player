// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { useAppStore } from './react';

describe('useAppStore', () => {
  it('accepts selectors that build new arrays without looping', () => {
    const store = createStore<{ items: number[] | undefined }>()(() => ({ items: undefined }));
    let renders = 0;
    function View() {
      renders++;
      const doubled = useAppStore(store, (s) => (s.items ?? []).map((n) => n * 2));
      return <span>{doubled.join(',')}</span>;
    }

    const { container } = render(<View />);
    act(() => store.setState({ items: [1, 2] }));

    expect(container.textContent).toBe('2,4');
    expect(renders).toBeLessThan(5);
  });
});
