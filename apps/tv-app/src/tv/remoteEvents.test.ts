import { createRemoteNormalizer, type RemoteEvent } from './remoteEvents';

function run(events: RemoteEvent[]) {
  const out: string[] = [];
  const normalize = createRemoteNormalizer((e) => out.push(`${e.key}:${e.action}`));
  events.forEach(normalize);
  return out;
}

describe('createRemoteNormalizer', () => {
  it('turns a release without a press into a tap (what the Android TV emulator sends for arrows and select)', () => {
    expect(run([{ key: 'right', action: 'up' }])).toEqual(['right:down', 'right:up']);
    expect(run([{ key: 'select', action: 'up' }])).toEqual(['select:down', 'select:up']);
  });

  it('passes real press/hold/release sequences through unchanged', () => {
    const held: RemoteEvent[] = [
      { key: 'left', action: 'down' },
      { key: 'left', action: 'down' },
      { key: 'left', action: 'up' },
      { key: 'left', action: 'up' },
    ];
    expect(run(held)).toEqual(['left:down', 'left:down', 'left:up', 'left:down', 'left:up']);
  });

  it('leaves events without an action alone', () => {
    expect(run([{ key: 'playPause', action: 'unknown' }])).toEqual(['playPause:unknown']);
  });
});
