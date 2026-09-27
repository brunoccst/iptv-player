import { Modal, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';
import { t } from '@iptv/shared';

export interface CardMenuAction {
  label: string;
  onPress(): void;
  testID?: string;
  /** Shown but not selectable (an episode already downloaded). */
  disabled?: boolean;
}

/**
 * Options for one card, opened by holding OK on it (a long touch on phones), D-078. The actions come first and
 * "Cancel" is always last; Back also closes it. Rows pass the actions that fit them (Continue Watching: remove).
 */
export function CardMenu({
  title,
  subtitle,
  actions,
  onClose,
}: {
  title: string;
  subtitle?: string | null;
  actions: CardMenuAction[];
  onClose(): void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="card-menu">
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {actions.map((action, index) => (
            <FocusButton
              key={action.label}
              label={action.label}
              variant="primary"
              hasTVPreferredFocus={index === actions.findIndex((entry) => !entry.disabled)}
              testID={action.testID}
              disabled={action.disabled}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            />
          ))}
          <FocusButton
            label={t('Cancel')}
            variant="ghost"
            hasTVPreferredFocus={actions.every((entry) => entry.disabled)}
            onPress={onClose}
            testID="card-menu-cancel"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 440,
    maxWidth: '100%',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: fonts.small, marginTop: -6, marginBottom: 4 },
});
