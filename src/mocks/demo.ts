// Demo data around UW Seattle. Used when Firebase isn't configured (DEMO MODE)
// so UI/map work can start before the backend exists.
import { HAZARDS, simulatedArea } from '@/lib/hazards';
import type { Announcement, Group, HazardAlert, HazardType, LatLng, Member } from '@/types';

export const UW_CENTER: LatLng = { latitude: 47.6553, longitude: -122.3035 };

export const DEMO_GROUP: Group = {
  id: 'demo-group',
  name: 'Demo Family',
  inviteCode: 'DUB026',
  memberIds: ['me', 'mom', 'sis'],
  meetingPlace: {
    id: 'meet',
    name: 'Drumheller Fountain',
    coord: { latitude: 47.6537, longitude: -122.3078 },
    type: 'meeting',
  },
  safeAreas: [
    { id: 'stadium', name: 'Husky Stadium (open area)', coord: { latitude: 47.6503, longitude: -122.3016 }, type: 'open_area' },
    { id: 'uwmc', name: 'UW Medical Center', coord: { latitude: 47.6497, longitude: -122.3078 }, type: 'hospital' },
    { id: 'hec', name: 'HEC Ed Pavilion (shelter)', coord: { latitude: 47.6527, longitude: -122.3013 }, type: 'shelter' },
  ],
};

const now = Date.now();
export const DEMO_MEMBERS: Member[] = [
  { uid: 'mom', name: 'Mom', location: { latitude: 47.6615, longitude: -122.3128 }, locationTs: now - 3 * 60_000, status: 'safe' },
  { uid: 'sis', name: 'Sis', location: { latitude: 47.6585, longitude: -122.3005 }, locationTs: now - 25 * 60_000, status: 'need_help' },
];

/** Demo-only announcement that "arrives" a few seconds after you send one, so the banner and
 *  notification can be tried with one phone. */
export const DEMO_ANNOUNCEMENT: Omit<Announcement, 'id' | 'sentAt'> = {
  groupId: DEMO_GROUP.id,
  groupName: DEMO_GROUP.name,
  title: 'Everyone meet at Drumheller Fountain at 5:00',
  details: 'Please be there soon',
  senderId: 'mom',
  senderName: 'Mom',
};

export function makeSimulatedAlert(at: LatLng, hazard: HazardType = 'earthquake'): HazardAlert {
  const h = HAZARDS[hazard];
  return {
    id: `sim-${hazard}-${Date.now()}`,
    source: 'simulated',
    hazard,
    title: h.simTitle,
    description: h.simDescription,
    instruction: h.instruction,
    severity: 'extreme',
    areas: [simulatedArea(hazard, at)],
    center: at,
    issuedAt: Date.now(),
    expiresAt: null,
  };
}
