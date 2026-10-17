// Demo data around UW Seattle. Used when Firebase isn't configured (DEMO MODE)
// so UI/map work can start before the backend exists.
import type { Group, HazardAlert, LatLng, Member } from '@/types';

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

export function makeSimulatedAlert(at: LatLng): HazardAlert {
  const d = 0.02;
  return {
    id: `sim-${Date.now()}`,
    source: 'simulated',
    title: 'Earthquake Warning (SIMULATED)',
    description: 'M6.8 earthquake detected near Seattle. Strong shaking expected.',
    instruction: 'Drop, cover, and hold on. When shaking stops, go to your meeting place.',
    severity: 'extreme',
    areas: [[
      { latitude: at.latitude + d, longitude: at.longitude - d },
      { latitude: at.latitude + d, longitude: at.longitude + d },
      { latitude: at.latitude - d, longitude: at.longitude + d },
      { latitude: at.latitude - d, longitude: at.longitude - d },
    ]],
    center: at,
    issuedAt: Date.now(),
    expiresAt: null,
  };
}
