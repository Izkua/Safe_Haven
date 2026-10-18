// [UI] "Set by Sam, 5 min ago": who last set a meeting point, so changes are never silent.
import { formatAge } from '@/lib/geo';
import type { Place } from '@/types';

/** Null for places saved before attribution existed (no setAt). */
export function meetingSetBy(place: Place | null | undefined, myUid: string | null, now = Date.now()): string | null {
  if (!place?.setAt) return null;
  const who = place.setBy && place.setBy === myUid ? 'you' : place.setByName || 'someone';
  return `Set by ${who}, ${formatAge(Math.max(0, now - place.setAt))}`;
}
