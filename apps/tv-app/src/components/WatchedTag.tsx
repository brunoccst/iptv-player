import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { WATCHED_LABEL } from '@iptv/shared';
import { colors } from '../theme';
import { Icon } from './Icon';

/**
 * "Watched" tag (D-081): bottom right of a watched title's cover, next to the title in its details, on watched episodes.
 * A check in a light pill, readable over any poster. Same look as the web app's `.watched-tag`.
 */
export function WatchedTag({ style, testID }: { style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[styles.tag, style]} testID={testID} accessibilityLabel={WATCHED_LABEL}>
      <Icon name="check" size={12} color={colors.bg} />
      <Text style={styles.text}>{WATCHED_LABEL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingLeft: 5,
    paddingRight: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  text: { color: colors.bg, fontSize: 11, fontWeight: '700' },
});
