import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { stores } from '../appContext';
import { usePin } from '../hooks';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';
import { pinMessage, PinPad } from './PinPad';

type Step = 'current' | 'choose' | 'new' | 'confirm' | 'done';

/** Account menu → Parental PIN (D-054): optional; set one, or change/remove it after entering the current one. */
export function PinSettings({ onClose }: { onClose(): void }) {
  const hasPin = usePin((s) => s.status === 'set');
  const [step, setStep] = useState<Step>(hasPin ? 'current' : 'new');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState('');

  if (step === 'current')
    return (
      <PinPad
        key="current"
        title="Enter the current parental PIN"
        onClose={onClose}
        submit={async (pin) => {
          const result = await stores.pin.getState().verify(pin);
          if (result !== 'ok') return pinMessage(result);
          setCurrent(pin);
          setStep('choose');
          return null;
        }}
      />
    );
  if (step === 'new')
    return (
      <PinPad
        key="new"
        title={hasPin ? 'Choose a new PIN' : 'Choose a 4-digit parental PIN'}
        onClose={onClose}
        submit={async (pin) => {
          setNext(pin);
          setStep('confirm');
          return null;
        }}
      />
    );
  if (step === 'confirm')
    return (
      <PinPad
        key="confirm"
        title="Enter the new PIN again"
        onClose={onClose}
        submit={async (pin) => {
          if (pin !== next) {
            setStep('new');
            return 'The PINs did not match. Start again.';
          }
          const result = await stores.pin.getState().setPin(pin, current);
          if (result !== 'ok') return pinMessage(result);
          setMessage(hasPin ? 'PIN changed.' : 'PIN set. Leaving a Kids profile and managing profiles now ask for it.');
          setStep('done');
          return null;
        }}
      />
    );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="pin-settings">
          <Text style={styles.title}>Parental PIN</Text>
          {step === 'done' ? (
            <>
              <Text style={styles.text}>{message}</Text>
              <FocusButton label="Close" variant="primary" hasTVPreferredFocus onPress={onClose} />
            </>
          ) : (
            <>
              <Text style={styles.text}>Signing out also removes the PIN.</Text>
              <FocusButton label="Change PIN" variant="primary" hasTVPreferredFocus testID="pin-change" onPress={() => setStep('new')} />
              <FocusButton
                label="Remove PIN"
                variant="ghost"
                testID="pin-remove"
                onPress={async () => {
                  const result = await stores.pin.getState().removePin(current);
                  setMessage(result === 'ok' ? 'PIN removed. Profiles are no longer locked.' : (pinMessage(result) ?? ''));
                  setStep('done');
                }}
              />
              <FocusButton label="Cancel" variant="ghost" onPress={onClose} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 360,
    maxWidth: '100%',
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  text: { color: colors.text, fontSize: fonts.small },
});
