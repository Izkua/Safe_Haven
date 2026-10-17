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
