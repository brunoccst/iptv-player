import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { episodeLabel, formatClock, SKIP_SECONDS, t, type MergedEpisode } from '@iptv/shared';
import { FocusRow } from './ui/FocusRow';
import { IconButton } from './ui/IconButton';
import { colors } from './ui/theme';

interface PlayerControlsProps {
  playing: boolean;
  live: boolean;
  time: number;
  duration: number;
  previous?: MergedEpisode | null;
  next?: MergedEpisode | null;
  /** A series: the Episodes button. */
  episodes: boolean;
  onTogglePlay(): void;
  onRestart(): void;
  onSkip(direction: 'back' | 'forward'): void;
  onEpisode(episode: MergedEpisode): void;
  onGuide(): void;
  onAudio(): void;
  onSubtitles(): void;
  onEpisodes(): void;
  /** TV: the buttons take focus only while they are open (the remote's keys drive the video, D-077). */
  focusable?: boolean;
  /** TV: which button has the focus when they open. */
  preferredFocus?: 'play' | null;
  /** The desktop's mute button and volume slider, before the time. */
  volume?: ReactNode;
  /** The desktop's full screen button, at the end. */
  trailing?: ReactNode;
}

/**
 * The row of buttons under the player's timeline, the same on every app (issue #237, DECISIONS.md#d-217): play/pause,
 * from the beginning, previous episode, ±10 s, next episode and the time on the left; Guide (live), Audio, Subtitles
 * and Episodes on the right, in the drawer's order (D-077). Each app keeps its video, its timeline and its keys.
 */
export function PlayerControls(props: PlayerControlsProps) {
  const { playing, live, time, duration, previous, next, focusable = true } = props;
  const button = (icon: Parameters<typeof IconButton>[0]['icon'], label: string, onPress: () => void, extra = {}) => (
    <IconButton icon={icon} label={label} plain focusable={focusable} size={44} iconSize={28} onPress={onPress} {...extra} />
  );
  return (
    <FocusRow style={styles.controls}>
      {button(playing ? 'pause' : 'play', playing ? t('Pause') : t('Play'), props.onTogglePlay, {
        iconSize: 30,
        testID: 'player-toggle',
        hasTVPreferredFocus: props.preferredFocus === 'play',
      })}
      {live ? null : (
        <>
          {button('restart', t('Play from the beginning'), props.onRestart, { testID: 'player-restart' })}
          {previous
            ? button('previous', t('Previous episode: {episode}', { episode: episodeLabel(previous) }), () => props.onEpisode(previous), {
                testID: 'player-previous',
              })
            : null}
          {button('rewind10', t('Back {seconds} seconds', { seconds: SKIP_SECONDS }), () => props.onSkip('back'))}
          {button('forward10', t('Forward {seconds} seconds', { seconds: SKIP_SECONDS }), () => props.onSkip('forward'))}
          {next
            ? button('next', t('Next episode: {episode}', { episode: episodeLabel(next) }), () => props.onEpisode(next), {
                testID: 'player-next',
              })
            : null}
        </>
      )}
      {props.volume}
      {live ? null : (
        <Text style={styles.time} testID="player-time">
          {formatClock(time)} / {formatClock(duration)}
        </Text>
      )}
      <View style={styles.spacer} />
      {live ? button('guide', t('Guide'), props.onGuide, { iconSize: 26, testID: 'player-guide', colourKey: 'blue' }) : null}
      {button('audio', t('Audio'), props.onAudio, { iconSize: 26, testID: 'player-audio', colourKey: 'green' })}
      {button('subtitles', t('Subtitles'), props.onSubtitles, { iconSize: 26, testID: 'player-subtitles' })}
      {props.episodes ? button('episodes', t('Episodes'), props.onEpisodes, { iconSize: 26, testID: 'player-episodes' }) : null}
      {props.trailing}
    </FocusRow>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  time: { color: colors.strong, fontSize: 14.4, fontVariant: ['tabular-nums'] },
  spacer: { flex: 1 },
});
