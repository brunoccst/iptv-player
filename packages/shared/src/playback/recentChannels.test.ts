import { describe, expect, it } from 'vitest';
import { addRecentChannel, MAX_RECENT_CHANNELS, recentChannelOf, recentChannelTarget } from './recentChannels';

const channel = (id: string) => ({ id, name: `Channel ${id}`, logoUrl: null, categoryId: 'news' });

describe('recent channels (issue #122)', () => {
  it('puts the channel first, once, and keeps the newest MAX_RECENT_CHANNELS', () => {
    let list = addRecentChannel(null, channel('1'));
    list = addRecentChannel(list, channel('2'));
    list = addRecentChannel(list, channel('1'));
    expect(list.map((c) => c.id)).toEqual(['1', '2']);
    for (let i = 3; i < 40; i++) list = addRecentChannel(list, channel(String(i)));
    expect(list).toHaveLength(MAX_RECENT_CHANNELS);
    expect(list[0]!.id).toBe('39');
  });

  it('goes from a live target to a channel and back', () => {
    const target = recentChannelTarget(channel('7'));
    expect(target).toMatchObject({ kind: 'live', streamId: '7', title: 'Channel 7', categoryId: 'news' });
    expect(recentChannelOf(target)).toEqual(channel('7'));
  });
});
