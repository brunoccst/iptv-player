import type { CSSProperties } from 'react';
import type { FocusDestination, View } from 'react-native';
import { colors, fonts, radius } from './theme';

export interface SelectOption {
  value: string;
  label: string;
}

const box: CSSProperties = {
  minHeight: 48,
  padding: '12px 40px 12px 14px',
  border: `1px solid ${colors.border}`,
  borderRadius: radius,
  // The chevron, drawn like the TV's box; the browser's own arrow is hidden.
  background: `${colors.input} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='%23e5e5e5'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E") no-repeat right 12px center`,
  appearance: 'none',
  color: colors.strong,
  fontFamily: 'inherit',
  fontSize: fonts.body,
  cursor: 'pointer',
};

/**
 * `Select.tsx` for React Native Web (desktop): the browser's own drop-down, which the mouse and keyboard already know,
 * in the TV's dark box. The TV's focus props have nothing to do here.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  testID,
  compact,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
  testID?: string;
  compact?: boolean;
  onFocus?(): void;
  onBlur?(): void;
  focusRef?: (view: View | null) => void;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
}) {
  return (
    <select
      aria-label={label}
      data-testid={testID}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      style={
        compact
          ? { ...box, minHeight: 40, padding: '8px 36px 8px 12px', alignSelf: 'flex-start', maxWidth: '100%' }
          : { ...box, width: '100%' }
      }
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
