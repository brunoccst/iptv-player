// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EpisodePlot } from './EpisodePlot';

describe('episode description (issue #160)', () => {
  afterEach(cleanup);

  it('shows two lines; a click shows all of it, another click folds it again', () => {
    render(<EpisodePlot text="40m · A long plot that goes on and on." />);
    const plot = screen.getByRole('button', { name: '40m · A long plot that goes on and on.' });
    expect(plot).toHaveProperty('className', expect.stringContaining('episode__plot--clamped'));
    expect(plot.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(plot);
    expect(plot.className).not.toContain('episode__plot--clamped');
    expect(plot.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(plot);
    expect(plot.className).toContain('episode__plot--clamped');
  });
});
