// [UI] Meeting point wording: "Set by Sam, 5 min ago" and the "meeting point moved" notification.
import { formatAge } from '@/lib/geo';
import type { LatLng, Place } from '@/types';

/** Null for places saved before attribution existed (no setAt). */
export function meetingSetBy(place: Place | null | undefined, myUid: string | null, now = Date.now()): string | null {
  if (!place?.setAt) return null;
  const who = place.setBy && place.setBy === myUid ? 'you' : place.setByName || 'someone';
  return `Set by ${who}, ${formatAge(Math.max(0, now - place.setAt))}`;
}

/** The parts of a reverse-geocode result we use (expo-location's LocationGeocodedAddress). */
export type StreetAddressParts = {
  name?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  city?: string | null;
};

/** "4060 George Washington Ln NE, Seattle"; falls back to the place name (e.g. a park). */
export function formatStreetAddress(a: StreetAddressParts | null | undefined): string | null {
  if (!a) return null;
  const street = [a.streetNumber, a.street].filter(Boolean).join(' ');
  const line = street || a.name || '';
  if (!line) return a.city || null;
  return a.city && !line.includes(a.city) ? `${line}, ${a.city}` : line;
}

/** Last resort when there's no address: "47.6553, -122.3035". */
export function formatCoord(c: LatLng): string {
  return `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`;
}

/** Family: meeting point "Front lawn" moved. Sam set it to 4060 George Washington Ln NE, Seattle. */
export function meetingMovedNotice(groupName: string, place: Place, where: string | null): { title: string; body: string } {
  return {
    title: `${groupName}: meeting point "${place.name}" moved`,
    body: `${place.setByName || 'Someone'} set it to ${where || place.address || formatCoord(place.coord)}.`,
  };
}
