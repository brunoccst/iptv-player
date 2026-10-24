import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { t } from '@iptv/shared';
import { useScreenHost } from './host';
import { pinMessage, PinPad } from './PinPad';
import { Dialog } from './ui/Dialog';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';

type Step = 'current' | 'choose' | 'new' | 'confirm' | 'done';

/**
 * Account menu → Parental PIN (D-054), the same on every app (DECISIONS.md#d-219): optional; set one, typed twice on
 * the keypad, or change or remove it after entering the current one.
 */
export function PinSettings({ onClose }: { onClose(): void }) {
  const { stores, hooks } = useScreenHost();
  const hasPin = hooks.usePin((s) => s.status === 'set');
  const [step, setStep] = useState<Step>(hasPin ? 'current' : 'new');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState('');

  if (step === 'current')
    return (
      <PinPad
        key="current"
        title={t('Enter the current parental PIN')}
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
        title={hasPin ? t('Choose a new PIN') : t('Choose a 4-digit parental PIN')}
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
        title={t('Enter the new PIN again')}
        onClose={onClose}
        submit={async (pin) => {
          if (pin !== next) {
            setStep('new');
            return t('The PINs did not match. Start again.');
          }
          const result = await stores.pin.getState().setPin(pin, current);
          if (result !== 'ok') return pinMessage(result);
          setMessage(hasPin ? t('PIN changed.') : t('PIN set. Leaving a Kids profile and managing profiles now ask for it.'));
          setStep('done');
          return null;
        }}
      />
    );

  return (
    <Dialog title={t('Parental PIN')} onClose={onClose} testID="pin-settings" width={360}>
      {step === 'done' ? (
        <>
          <Text style={styles.text} {...(Platform.OS === 'web' ? { role: 'status' } : null)}>
            {message}
          </Text>
          <FocusButton label={t('Close')} variant="primary" hasTVPreferredFocus onPress={onClose} />
        </>
      ) : (
        <>
          <Text style={styles.text}>{t('Signing out also removes the PIN.')}</Text>
          <FocusButton label={t('Change PIN')} variant="primary" hasTVPreferredFocus testID="pin-change" onPress={() => setStep('new')} />
          <FocusButton
            label={t('Remove PIN')}
            variant="ghost"
            testID="pin-remove"
            onPress={async () => {
              const result = await stores.pin.getState().removePin(current);
              setMessage(result === 'ok' ? t('PIN removed. Profiles are no longer locked.') : (pinMessage(result) ?? ''));
              setStep('done');
            }}
          />
          <FocusButton label={t('Cancel')} variant="ghost" onPress={onClose} />
        </>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: fonts.small },
});
