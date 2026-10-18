// [OWNER: UI] SafeHaven visual language: "Quiet by default. Red means danger."
// Bone ground, ink text and actions. Color is earned: red only for danger / need help,
// amber only for advisories, green for safe and shelters. No shadows, gradients or rounding.
import type { AlertSeverity } from '@/types';

export const palette = {
  bone: '#ECEDE7',
  boneDeep: '#E3E4DD',
  ink: '#121412',
  inkSoft: '#5A5F5A',
  rule: '#C9CBC3',
  danger: '#C4161C',
  watch: '#F2B705',
  safe: '#1F5E4F',
  white: '#FFFFFF',
};

// Semantic names used across screens.
export const colors = {
  bg: palette.bone,
  card: palette.boneDeep,
  text: palette.ink,
  muted: palette.inkSoft,
  rule: palette.rule,
  primary: palette.ink, // everyday actions are ink, not blue
  onPrimary: palette.bone,
  safe: palette.safe,
  danger: palette.danger,
  onDanger: palette.white,
  warn: palette.watch, // amber is a FILL; put ink text on it, never amber text on bone
  meeting: palette.ink,
  shelter: palette.safe,
};

export const statusColor = { safe: colors.safe, need_help: colors.danger, unknown: colors.muted } as const;

export const radius = 2;
export const minTarget = 56;

export const type = {
  number: { fontSize: 56, lineHeight: 52, fontWeight: '700' as const },
  h1: { fontSize: 40, lineHeight: 42, fontWeight: '700' as const },
  heading: { fontSize: 24, lineHeight: 27, fontWeight: '700' as const },
  body: { fontSize: 18, lineHeight: 26, fontWeight: '400' as const },
  label: { fontSize: 15, fontWeight: '600' as const },
};

/** Urgency ladder: tone escalates with danger. */
export type Urgency = 'watch' | 'warning' | 'emergency';

/** NWS minor/moderate → watch · severe → warning · extreme → emergency (USGS: M4 / M5 / M6+). */
export function urgencyFor(severity: AlertSeverity): Urgency {
  if (severity === 'extreme') return 'emergency';
  if (severity === 'severe') return 'warning';
  return 'watch';
}
