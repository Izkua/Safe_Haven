// [OWNER: UI] Vibration per urgency level (design: urgency ladder).
// watch: one light tap · warning: two heavy pulses · emergency: heavy pulses repeating until acknowledged.
import * as Haptics from 'expo-haptics';
import type { Urgency } from '@/theme';

const safe = (p: Promise<void>) => p.catch(() => {});
const heavy = () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

/** Plays the pattern for `level`. Returns a stop function (needed for the repeating emergency pattern). */
export function buzzFor(level: Urgency): () => void {
  if (level === 'watch') {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    return () => {};
  }
  if (level === 'warning') {
    heavy();
    const t = setTimeout(heavy, 300);
    return () => clearTimeout(t);
  }
  // emergency: triple heavy pulse every 1.5 s
  const burst = () => {
    heavy();
    setTimeout(heavy, 180);
    setTimeout(heavy, 360);
  };
  burst();
  const id = setInterval(burst, 1500);
  return () => clearInterval(id);
}

export const tap = () => safe(Haptics.selectionAsync());
