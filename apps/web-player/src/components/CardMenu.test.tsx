// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardMenu, menuPosition } from './CardMenu';

describe('card menu (right-click, D-079)', () => {
  afterEach(cleanup);

  it('a right-click opens the menu at the pointer; the keyboard (no pointer) at the card', () => {
    const card = document.createElement('div');
    card.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
    expect(menuPosition({ clientX: 120, clientY: 80, currentTarget: card })).toEqual({ x: 120, y: 80 });
    expect(menuPosition({ clientX: 0, clientY: 0, currentTarget: card })).toEqual({ x: 12, y: 12 });
  });

  it('lists the actions then Cancel; ↑/↓ move, an action runs and closes; Escape and outside clicks close', () => {
    const onClose = vi.fn();
    const remove = vi.fn();
    render(
      <CardMenu
        title="Show"
        subtitle="S1:E3"
        position={{ x: 10, y: 10 }}
        onClose={onClose}
        actions={[{ label: 'Remove from Continue Watching', onSelect: remove }]}
      />,
    );
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Remove from Continue Watching', 'Cancel']);
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.click(items[0]!);
    expect(remove).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledOnce();
  });
});
