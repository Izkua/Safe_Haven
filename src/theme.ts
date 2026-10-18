// [OWNER: UI] SafeHaven visual language: calm surfaces, real buttons, color only when it means something.
// Light = dark brown on beige; dark (the default) = soft white on grey. Red means danger, amber means
// watch, green means safe. Everything else is neutral. See DESIGN.md.
import { Appearance, DynamicColorIOS, Platform, type ColorValue } from 'react-native';
import { getStartupPref } from '@/lib/appearance';
import type { AlertSeverity } from '@/types';

export const palette = {
  // light (beige)
  sand: '#E8DFCF',
  sandDeep: '#DCCFB8',
  bark: '#2A2118',
  barkSoft: '#5E5141',
  sandRule: '#CDBFA6',
  sandInk: '#F4EEE3', // text on dark fills in light mode
  dangerTextLight: '#962A1B',
  safeLight: '#255E42',
  // dark (grey)
  slate: '#1E2023',
  slateRaised: '#2D3035',
  mist: '#ECEDEE',
  mistSoft: '#A6ABB2',
  slateRule: '#3A3E44',
  dangerTextDark: '#FF6B5E',
  safeDark: '#5CC08B',
  // signals (same in both)
  danger: '#B3261E',
  onDanger: '#FFF4EF',
  watch: '#E3A21A',
  safeFill: '#2C6B4B',
  // route line (map overlay only)
  // Apple Maps style: bright system blue with a thin, darker blue border.
  routeLight: '#1A7CF5',
  routeCasingLight: '#0B57C9',
  routeDark: '#2E8BFF',
  routeCasingDark: '#0A4FB8',
};

// Dark is the default. index.tsx loads the saved preference (Dark / Light / Match phone) and applies
// it with Appearance.setColorScheme() before this module is evaluated.
// iOS swaps these live when the appearance changes (no re-render needed). Android has no dynamic
// colors, so it resolves once here from the startup preference (changing it needs a restart).
const startup = getStartupPref();
const launchScheme = startup === 'system' ? Appearance.getColorScheme() : startup;
function adaptive(light: string, dark: string): ColorValue {
  if (Platform.OS === 'ios') return DynamicColorIOS({ light, dark });
  return launchScheme === 'light' ? light : dark;
}

// Semantic names used across screens.
export const colors = {
  bg: adaptive(palette.sand, palette.slate),
  /** Tonal surface: secondary buttons, banners, inputs. */
  card: adaptive(palette.sandDeep, palette.slateRaised),
  text: adaptive(palette.bark, palette.mist),
  muted: adaptive(palette.barkSoft, palette.mistSoft),
  rule: adaptive(palette.sandRule, palette.slateRule),
  /** Filled primary button. */
  primary: adaptive(palette.bark, palette.mist),
  onPrimary: adaptive(palette.sandInk, palette.slate),
  /** Green TEXT / icons / markers. */
  safe: adaptive(palette.safeLight, palette.safeDark),
  /** Green FILL (active "I'm safe"), with onSafe text. */
  safeFill: palette.safeFill as ColorValue,
  onSafe: palette.sandInk as ColorValue,
  /** Red FILL (alert headers, emergency screen, badges, active "Need help"): same in both. */
  danger: palette.danger as ColorValue,
  /** Red TEXT / icons / outlines on the page or a tonal surface. */
  dangerText: adaptive(palette.dangerTextLight, palette.dangerTextDark),
  onDanger: palette.onDanger as ColorValue,
  /** Amber is a FILL only; put onWarn text on it. */
  warn: palette.watch as ColorValue,
  onWarn: palette.bark as ColorValue,
  meeting: adaptive(palette.bark, palette.mist),
  shelter: adaptive(palette.safeLight, palette.safeDark),
};

/**
 * Plain-string colors for APIs that can't take dynamic colors (react-native-maps overlay props).
 * Pass `useColorScheme()` so the screen re-renders when the appearance flips.
 */
export function mapOverlayColors(scheme: string | null | undefined) {
  const dark = scheme !== 'light';
  return {
    // Route Blue: the one non-signal color, reserved for the route line so it reads as "the way"
    // and never as danger/watch/safe. Drawn over a darker blue casing (Apple Maps style).
    route: dark ? palette.routeDark : palette.routeLight,
    routeCasing: dark ? palette.routeCasingDark : palette.routeCasingLight,
    danger: dark ? palette.dangerTextDark : palette.danger,
  };
}

/**
 * Plain-string colors for the native stack header, which doesn't reliably take dynamic colors
 * (it fell back to a white header). Pass `useColorScheme()` so it follows light / dark mode.
 */
export function headerColors(scheme: string | null | undefined) {
  const dark = scheme !== 'light';
  return {
    bg: dark ? palette.slate : palette.sand,
    text: dark ? palette.mist : palette.bark,
    /** Header buttons (inside the header, dynamic colors resolve as light mode). */
    card: dark ? palette.slateRaised : palette.sandDeep,
  };
}

export const statusColor ={ safe: colors.safe, need_help: colors.dangerText, unknown: colors.muted } as const;

/** Corner radius for buttons, banners and inputs. */
export const radius = 12;
/** Minimum height of anything tappable. */
export const minTarget = 56;

/** Two weights, iOS-standard sizes. */
export const type = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' as const },
  button: { fontSize: 17, fontWeight: '600' as const },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
};

/** Urgency ladder: tone escalates with danger. */
export type Urgency = 'watch' | 'warning' | 'emergency';

/** NWS minor/moderate → watch · severe → warning · extreme → emergency (USGS: M4 / M5 / M6+). */
export function urgencyFor(severity: AlertSeverity): Urgency {
  if (severity === 'extreme') return 'emergency';
  if (severity === 'severe') return 'warning';
  return 'watch';
}

// [UI] Distinct member colors for map pins / avatars. Avoids red (need help), purple (meeting)
// and light blue (shelters) so a member can't be mistaken for a status or a place. All dark
// enough for a light initial on top.
export const memberPalette = ['#00796b', '#e65100', '#c2185b', '#3949ab', '#6d4c41', '#00838f', '#827717', '#546e7a'];

// [UI] One color per group, for its meeting point on the map and its chip on the Group tab.
// No red / green / amber: those mean danger / safe / watch. Dark enough for a white outline.
export const groupPalette = ['#2F6FED', '#8E44AD', '#00897B', '#D81B60', '#3949AB', '#795548'];

/** Stable color per group: by its position in my groups list, hash as fallback. */
export function groupColor(groupId: string, groupIds: string[]): string {
  let i = groupIds.indexOf(groupId);
  if (i < 0) i = [...groupId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  return groupPalette[i % groupPalette.length];
}

/** Stable color per member: by join order in the group (unique up to 8 members), hash as fallback. */
export function memberColor(uid: string, memberIds: string[]): string {
  let i = memberIds.indexOf(uid);
  if (i < 0) i = [...uid].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  return memberPalette[i % memberPalette.length];
}
