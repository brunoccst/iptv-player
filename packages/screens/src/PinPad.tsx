import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { PIN_LENGTH, type PinGate, type PinResult, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { focus } from './ui/focus';
import { FocusRow } from './ui/FocusRow';
import { Icon } from './ui/Icon';
import { colors, fonts, radius } from './ui/theme';

export const pinMessage = (result: PinResult) =>
  result === 'locked' ? t('Too many wrong tries. Try again in a minute.') : result === 'wrong' ? t('Wrong PIN.') : null;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'cancel'] as const;
type Key = (typeof KEYS)[number];

/**
 * Parental PIN entry (D-054), the same on every app (issue #237, DECISIONS.md#d-219): a keypad the D-pad, touch and
 * mouse can use; on the desktop the keyboard's digits and Backspace type too. Submits once 4 digits are in; `submit`
 * returns an error message to show (and clear the digits) or null when accepted.
 */
export function PinPad({ title, submit, onClose }: { title: string; submit(pin: string): Promise<string | null>; onClose(): void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const pinRef = useRef(pin);
  pinRef.current = pin;

  const press = async (key: Key) => {
    if (busy.current) return;
    if (key === 'cancel') return onClose();
    if (key === 'back') return setPin(pinRef.current.slice(0, -1));
    const next = pinRef.current + key;
    pinRef.current = next;
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    busy.current = true;
    const message = await submit(next);
    busy.current = false;
    // Cleared either way: a wrong PIN is typed again; an accepted one may lead to the next step on the same pad.
    pinRef.current = '';
    setPin('');
    setError(message);
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) void pressRef.current(event.key as Key);
      else if (event.key === 'Backspace') void pressRef.current('back');
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dialog title={title} onClose={onClose} testID="pin-pad" width={320}>
      <View style={styles.body}>
        <View
          style={styles.dots}
          accessibilityLabel={t('{count} of {total} digits', { count: pin.length, total: PIN_LENGTH })}
          testID="pin-dots"
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>
        {error ? (
          <Text style={styles.error} {...(Platform.OS === 'web' ? { role: 'alert' } : { accessibilityLiveRegion: 'polite' })}>
            {error}
          </Text>
        ) : null}
        <FocusRow style={styles.keys}>
          {KEYS.map((key, index) => (
            <PinKey key={key} value={key} first={index === 0} onPress={() => void press(key)} />
          ))}
        </FocusRow>
      </View>
    </Dialog>
  );
}

function PinKey({ value, first, onPress }: { value: Key; first: boolean; onPress(): void }) {
  const [focused, setFocused] = useState(false);
  const label = value === 'back' ? t('Delete digit') : value === 'cancel' ? t('Cancel') : value;
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
        <Icon name="back" size={22} color={focused ? focus.onSolid : colors.text} />
      ) : value === 'cancel' ? (
        <Icon name="close" size={22} color={focused ? focus.onSolid : colors.text} />
      ) : (
        <Text style={[styles.keyText, focused && { color: focus.onSolid }]}>{value}</Text>
      )}
    </Pressable>
  );
}

/** Runs an action directly, or after the PIN when `needed`. Render `dialog` somewhere in the component. */
export function usePinGate(): { gate: PinGate; dialog: ReactNode } {
  const { stores } = useScreenHost();
  const [pending, setPending] = useState<{ title: string; action(): void } | null>(null);
  const gate: PinGate = (needed, title, action) => (needed ? setPending({ title, action }) : action());
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
  body: { gap: 16, alignItems: 'center' },
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
  keyFocused: { borderColor: focus.solid, backgroundColor: focus.solid, ...focus.glow },
  keyText: { color: colors.strong, fontSize: 22, fontWeight: '700' },
});
