// [OWNER: MAP] "Show this on the map" requests from other screens (e.g. the Group tab, the alert
// screen). Only the latest request is kept. A mounted map applies it right away (via onMapFocusRequest);
// otherwise the map takes it when it comes into view.
import type { Place } from '@/types';

export type MapFocus = {
  place: Place;
  label: string;
  /** [UI] We just routed there (alert screen): frame both my pin and the place, not just the place. */
  showMe?: boolean;
};

let waiting: MapFocus | null = null;
const listeners = new Set<() => void>();

export function requestMapFocus(f: MapFocus): void {
  waiting = f;
  listeners.forEach((l) => l());
}

/** The pending request (if any), cleared so it's only applied once. */
export function takeMapFocus(): MapFocus | null {
  const f = waiting;
  waiting = null;
  return f;
}

/** Called whenever a request comes in (the map then calls takeMapFocus). Returns unsubscribe. */
export function onMapFocusRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
