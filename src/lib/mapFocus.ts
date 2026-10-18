// [OWNER: MAP] "Show this on the map next time it's opened" requests from other screens (e.g. the
// Group tab). Only the latest request is kept; the map takes it when it comes into view.
import type { Place } from '@/types';

export type MapFocus = { place: Place; label: string };

let waiting: MapFocus | null = null;

export function requestMapFocus(f: MapFocus): void {
  waiting = f;
}

/** The pending request (if any), cleared so it's only applied once. */
export function takeMapFocus(): MapFocus | null {
  const f = waiting;
  waiting = null;
  return f;
}
