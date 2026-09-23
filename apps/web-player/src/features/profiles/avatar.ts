/** Deterministic avatar colour per profile. `avatarKey` (if set) is a CSS colour chosen in the editor. */
const PALETTE = ['#e50914', '#1f6feb', '#8250df', '#1a7f37', '#bf8700', '#d63384'];

export function avatarColor(profile: { id: string; avatarKey?: string | null }): string {
  if (profile.avatarKey && PALETTE.includes(profile.avatarKey)) return profile.avatarKey;
  const hash = [...profile.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length]!;
}

export const AVATAR_COLORS = PALETTE;
