import { useState, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { t } from '@iptv/shared';
import { useScreenHost, type MenuItem, type TitleMenuItem } from './host';
import { Dialog } from './ui/Dialog';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';

/**
 * Options for one title or episode (D-078), the same panel on every app (issue #237, DECISIONS.md#d-221): opened by
 * holding OK on TV, a long touch on phones, a right-click on the desktop, or an episode's "…". The options come first
 * and "Cancel" is always last; Back or Escape also closes it.
 */
export function CardMenu({
  title,
  subtitle,
  items,
  onClose,
}: {
  title: string;
  subtitle?: string | null;
  items: MenuItem[];
  onClose(): void;
}) {
  const first = items.findIndex((item) => !item.disabled);
  return (
    <Dialog title={title} label={t('Options for {title}', { title })} onClose={onClose} testID="card-menu" width={440}>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {items.map((item, index) => (
        <FocusButton
          key={item.id}
          label={item.label}
          variant="primary"
          hasTVPreferredFocus={index === first}
          testID={`card-menu-${item.id}`}
          disabled={item.disabled}
          icon={item.icon}
          iconAfter
          onPress={() => {
            onClose();
            item.run();
          }}
        />
      ))}
      <FocusButton
        label={t('Cancel')}
        variant="ghost"
        hasTVPreferredFocus={first === -1}
        icon="close"
        iconAfter
        onPress={onClose}
        testID="card-menu-cancel"
      />
    </Dialog>
  );
}

/** A title's card with its menu: held OK on TV, a long touch on phones, a right-click on the desktop (the host's trigger). */
export function TitleMenu({
  title,
  subtitle,
  items,
  children,
}: {
  title: string;
  subtitle?: string | null;
  items: () => TitleMenuItem[];
  children(openMenu?: () => void): ReactNode;
}) {
  const { MenuTrigger } = useScreenHost();
  const [open, setOpen] = useState(false);
  return (
    <>
      <MenuTrigger onOpen={() => setOpen(true)}>{children}</MenuTrigger>
      {open ? <CardMenu title={title} subtitle={subtitle} items={items()} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: colors.muted, fontSize: fonts.small, marginTop: -6, marginBottom: 4 },
});
