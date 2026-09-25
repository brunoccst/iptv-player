import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PIN_LENGTH, type PinResult } from '@iptv/shared';
import { stores } from '../appContext';
import { colors, fonts, radius } from '../theme';
import { Icon } from './Icon';

export const pinMessage = (result: PinResult) =>
  result === 'locked' ? 'Too many wrong tries. Try again in a minute.' : result === 'wrong' ? 'Wrong PIN.' : null;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'cancel'] as const;

/**
 * Parental PIN entry (D-054): a keypad the D-pad and touch can both use. Submits once 4 digits are in; `submit`
 * returns an error message to show (and clear the digits) or null when accepted.
 */
export function PinPad({ title, submit, onClose }: { title: string; submit(pin: string): Promise<string | null>; onClose(): void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = async (key: (typeof KEYS)[number]) => {
    if (busy) return;
    if (key === 'cancel') return onClose();
    if (key === 'back') return setPin(pin.slice(0, -1));
    const next = pin + key;
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    setBusy(true);
    const message = await submit(next);
    setBusy(false);
    // Cleared either way: a wrong PIN is typed again; an accepted one may lead to the next step on the same pad.
    setPin('');
    setError(message);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} accessibilityLabel={title} testID="pin-pad">
          <Text style={styles.title}>{title}</Text>
          <View style={styles.dots} accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits`}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.keys}>
            {KEYS.map((key, index) => (
              <Key key={key} value={key} first={index === 0} onPress={() => void press(key)} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Key({ value, first, onPress }: { value: (typeof KEYS)[number]; first: boolean; onPress(): void }) {
  const [focused, setFocused] = useState(false);
  const label = value === 'back' ? 'Delete digit' : value === 'cancel' ? 'Cancel' : value;
  return (
    <Pressable
      testID={`pin-key-${value}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      hasTVPreferredFocus={first}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.key, focused && styles.keyFocused]}
    >
      {value === 'back' ? (
        <Icon name="back" size={22} color={colors.text} />
      ) : value === 'cancel' ? (
        <Icon name="close" size={22} color={colors.text} />
      ) : (
        <Text style={styles.keyText}>{value}</Text>
      )}
    </Pressable>
  );
}

/** Runs an action directly, or after the PIN when `needed`. Render `dialog` somewhere in the component. */
export function usePinGate() {
  const [pending, setPending] = useState<{ title: string; action(): void } | null>(null);
  const gate = (needed: boolean, title: string, action: () => void) => (needed ? setPending({ title, action }) : action());
  const dialog = pending ? (
    <PinPad
      title={pending.title}
      onClose={() => setPending(null)}
      submit={async (pin) => {
        const result = await stores.pin.getState().verify(pin);
        if (result !== 'ok') return pinMessage(result);
        setPending(null);
        pending.action();
        return null;
      }}
    />
  ) : null;
  return { gate, dialog };
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 320,
    maxWidth: '100%',
    padding: 24,
    gap: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 14 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.text },
  dotFilled: { backgroundColor: colors.strong, borderColor: colors.strong },
  error: { color: colors.warning, fontSize: fonts.small },
  keys: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 64 + 2 * 10, gap: 10 },
  key: {
    width: 64,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.raised,
  },
  keyFocused: { borderColor: colors.strong, borderWidth: 2 },
  keyText: { color: colors.strong, fontSize: 22, fontWeight: '700' },
});
