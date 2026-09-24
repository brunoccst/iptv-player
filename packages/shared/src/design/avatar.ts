/** Deterministic avatar colour per profile (web and TV). `avatarKey` (if set) is a colour chosen in the profile editor. */
export const AVATAR_COLORS = ['#e50914', '#1f6feb', '#8250df', '#1a7f37', '#bf8700', '#d63384'];

export function avatarColor(profile: { id: string; avatarKey?: string | null }): string {
  if (profile.avatarKey && AVATAR_COLORS.includes(profile.avatarKey)) return profile.avatarKey;
  const hash = [...profile.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}
