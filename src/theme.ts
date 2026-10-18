export const colors = {
  bg: '#0f1115',
  card: '#1a1d24',
  text: '#f2f3f5',
  muted: '#9aa0aa',
  primary: '#2f80ed',
  safe: '#27ae60',
  danger: '#eb5757',
  warn: '#f2994a',
  meeting: '#9b51e0',
  shelter: '#2d9cdb',
};

export const statusColor = { safe: colors.safe, need_help: colors.danger, unknown: colors.muted } as const;

// [UI] Distinct member colors for map pins / avatars. Avoids red (need help), purple (meeting)
// and light blue (shelters) so a member can't be mistaken for a status or a place. All dark
// enough for a white initial on top.
export const memberPalette = ['#00796b', '#e65100', '#c2185b', '#3949ab', '#6d4c41', '#00838f', '#827717', '#546e7a'];

/** Stable color per member: by join order in the group (unique up to 8 members), hash as fallback. */
export function memberColor(uid: string, memberIds: string[]): string {
  let i = memberIds.indexOf(uid);
  if (i < 0) i = [...uid].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  return memberPalette[i % memberPalette.length];
}
