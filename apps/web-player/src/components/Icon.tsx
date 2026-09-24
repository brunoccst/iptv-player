/** Inline SVG icon (24×24, currentColor); paths shared with the TV app. */
import { iconPaths as paths, type IconName } from '@iptv/shared';

export type { IconName };

export function Icon({ name, size = 24, title }: { name: IconName; size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={paths[name]} />
    </svg>
  );
}
