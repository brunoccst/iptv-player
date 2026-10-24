import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { appLog, t } from '@iptv/shared';
import { Dialog, LogView } from '@iptv/screens';
import '../browse/screenHost';
import { appConfig } from '../../config';
import { desktop } from '../../desktop';

/**
 * Account menu → App → Log: the TV's log view in a dialog (D-079, DECISIONS.md#d-220). The TV shares it through the
 * Android share sheet; here it is saved as a text file or copied.
 */
export function LogDialog({ onClose }: { onClose(): void }) {
  const [copied, setCopied] = useState(false);

  const exportText = () => {
    const { text, lines, omitted } = appLog.shareText(Number.MAX_SAFE_INTEGER);
    return [
      `${appConfig.appName} diagnostics log`,
      `Saved ${new Date().toISOString()} · ${desktop ? `desktop ${desktop.version} (${desktop.platform})` : 'web'}`,
      `${lines} lines${omitted ? `, ${omitted} older left out` : ''}; repeats folded (credentials masked)`,
      '',
      text,
    ].join('\n');
  };
  const copy = async () => {
    await navigator.clipboard.writeText(exportText());
    setCopied(true);
  };
  const save = () => {
    const url = URL.createObjectURL(new Blob([exportText()], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${appConfig.appSlug}-log-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog title={t('Log')} onClose={onClose} testID="log-dialog" width={760}>
      <ScrollView style={styles.scroll}>
        <LogView
          hints={[t('Send this to support when something goes wrong. The server address, usernames, passwords and keys are hidden.')]}
          actions={[
            { label: t('Save log'), onPress: save, testID: 'log-save' },
            { label: copied ? t('Copied') : t('Copy log'), onPress: () => void copy(), testID: 'log-copy' },
          ]}
        />
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({ scroll: { flexShrink: 1 } });
