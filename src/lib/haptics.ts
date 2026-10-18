// [OWNER: UI] Brief attention patterns, once per warning; revisiting a warning stays quiet.
import * as Haptics from 'expo-haptics';
import { claimAlertAttention } from '@/lib/alertAttention';
import type { Urgency } from '@/theme';
const safe = (p: Promise<void>) => p.catch(() => {});
export function buzzFor(level: Urgency): () => void {
  const heavy = () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  if (level === 'watch') {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    return () => {};
  }
  heavy();
  const delays = level === 'warning' ? [300] : [180, 360];
  const timers = delays.map(delay => setTimeout(heavy, delay));
  return () => timers.forEach(clearTimeout);
}
export function buzzForAlert(id: string, level: Urgency): () => void {
  return claimAlertAttention(id, 'haptics') ? buzzFor(level) : () => {};
}
export const tap = () => safe(Haptics.selectionAsync());
