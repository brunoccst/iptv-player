// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Row } from './Row';

/** jsdom has no layout: give every element the track's sizes. */
function layout(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth });
}

const cards = ['a', 'b', 'c'].map((key) => <div key={key}>{key}</div>);

describe('Row arrows (D-159)', () => {
  afterEach(() => {
    cleanup();
    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });

  const left = () => screen.queryByRole('button', { name: 'Scroll Drama left' });
  const right = () => screen.queryByRole('button', { name: 'Scroll Drama right' });

  it('hides the left arrow at the beginning and the right arrow at the end', () => {
    layout(3000, 1000);
    const { container } = render(<Row title="Drama">{cards}</Row>);
    expect(left()).toBeNull();
    expect(right()).not.toBeNull();

    const track = container.querySelector('.row__track')!;
    act(() => {
      track.scrollLeft = 1000;
      fireEvent.scroll(track);
    });
    expect(left()).not.toBeNull();
    expect(right()).not.toBeNull();

    act(() => {
      track.scrollLeft = 2000;
      fireEvent.scroll(track);
    });
    expect(left()).not.toBeNull();
    expect(right()).toBeNull();
  });

  it('shows no arrows when every card fits', () => {
    layout(800, 1000);
    render(<Row title="Drama">{cards}</Row>);
    expect(left()).toBeNull();
    expect(right()).toBeNull();
  });
});
