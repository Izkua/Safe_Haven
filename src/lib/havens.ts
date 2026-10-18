import type { Group, HazardType, Place } from '@/types';
export const HAVEN_HAZARDS: HazardType[] = ['earthquake', 'tsunami', 'flood', 'wildfire', 'hurricane', 'tornado'];
export function isHazard(value: unknown): value is HazardType {
  return typeof value === 'string' && HAVEN_HAZARDS.includes(value as HazardType);
}
export function validHaven(place: Place | null | undefined): place is Place {
  return !!place && typeof place.name === 'string' && !!place.name.trim() &&
    Number.isFinite(place.coord?.latitude) && Math.abs(place.coord.latitude) <= 90 &&
    Number.isFinite(place.coord?.longitude) && Math.abs(place.coord.longitude) <= 180;
}
export function savedHaven(group: Group | null | undefined, hazard: HazardType): Place | null {
  const place = group?.disasterHavens?.[hazard];
  return validHaven(place) ? place : null;
}
export function withSavedHaven(group: Group, hazard: HazardType, place: Place): Group {
  return { ...group, disasterHavens: { ...group.disasterHavens, [hazard]: place } };
}

export function usualMeetingPoint(group: Group): Place | null {
  return group.activeHaven ? group.usualMeetingPlace ?? null : group.meetingPlace;
}
/** Preserve the usual point through any number of haven switches. */
export function destinationPatch(group: Group, place: Place, hazard: HazardType | null): Pick<Group, 'meetingPlace' | 'usualMeetingPlace' | 'activeHaven'> {
  return { meetingPlace: place, usualMeetingPlace: hazard ? usualMeetingPoint(group) : place, activeHaven: hazard };
}
