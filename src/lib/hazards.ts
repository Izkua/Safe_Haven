// [OWNER: ALERTS] Per-hazard guidance: what to do right now, and which kind of place to head to.
// Steps follow Ready.gov / NWS / USGS public guidance, shortened for a phone screen.
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { distanceM, tooFarToWalk } from '@/lib/geo';
import type { Group, HazardType, LatLng, Place, PlaceType } from '@/types';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface HazardInfo {
  label: string;
  icon: IconName;
  /** Simulated-alert copy. */
  simTitle: string;
  simDescription: string;
  /** One line, used as the notification body. */
  instruction: string;
  /** Ordered steps for someone INSIDE the affected area. */
  steps: string[];
  /** Shown above the route buttons: when (or whether) to move. */
  moveNote: string;
  /** Alert screen, "Right now" card: the 2 most urgent actions, as short bullets (no order). */
  now: string[];
  /** Alert screen, below the card: the next things to know, one short line each with an icon. */
  cards: { icon: IconName; text: string }[];
  /** Alert screen subtitle for a drill, e.g. "M6.8 earthquake". */
  simShort: string;
  /** Start of the main route button, e.g. "After shaking: go to" (then the place). */
  goPrefix: string;
  /** Safe-area types to prefer, best first. */
  preferred: PlaceType[];
  /** Safe-area types never to suggest for this hazard. */
  avoid: PlaceType[];
  /** Simulated affected area, as half-widths in degrees around the alert center. */
  simRadius: { lat: number; lng: number };
}

export const HAZARD_TYPES: HazardType[] = ['earthquake', 'tsunami', 'flood', 'wildfire', 'hurricane', 'tornado'];

export const HAZARDS: Record<HazardType, HazardInfo> = {
  earthquake: {
    label: 'Earthquake',
    icon: 'pulse',
    simTitle: 'Earthquake Warning (SIMULATED)',
    simDescription: 'M6.8 earthquake detected nearby. Strong shaking expected.',
    instruction: 'Drop, cover, and hold on. When the shaking stops, move to an open area.',
    steps: [
      'Drop to your hands and knees, cover your head and neck under a sturdy table or desk, and hold on until the shaking stops.',
      "Don't run outside or stand in a doorway while the ground is shaking.",
      'In bed: stay there and cover your head with a pillow. Outdoors: move away from buildings, trees, streetlights and power lines. Driving: pull over, stop and set the parking brake.',
      'When the shaking stops, check yourself and others for injuries. Expect aftershocks.',
      'Leave damaged buildings carefully. Watch for fallen power lines, broken glass and the smell of gas.',
      'If you are near the coast, go to high ground right away in case of a tsunami.',
    ],
    moveNote: "Don't move until the shaking stops. Then head to an open area away from buildings.",
    now: ['Get under a sturdy table and hold on', 'Stay inside. Don’t stand in a doorway'],
    cards: [
      { icon: 'arrow-forward', text: 'When it stops, go to an open area away from buildings' },
      { icon: 'medkit', text: 'Check for injuries. Expect aftershocks' },
      { icon: 'warning', text: 'Leave damaged buildings. Watch for gas, glass and wires' },
      { icon: 'trending-up', text: 'Near the coast? Go to high ground' },
    ],
    simShort: 'M6.8 earthquake',
    goPrefix: 'After shaking: go to',
    preferred: ['open_area', 'meeting', 'shelter', 'hospital'],
    avoid: [],
    simRadius: { lat: 0.02, lng: 0.03 },
  },
  tsunami: {
    label: 'Tsunami',
    icon: 'boat',
    simTitle: 'Tsunami Warning (SIMULATED)',
    simDescription: 'A tsunami is expected to reach this coastline. Dangerous waves and flooding are possible.',
    instruction: 'Move to high ground or as far inland as you can, now. Go on foot if possible.',
    steps: [
      'Leave the beach and low-lying coastal areas immediately. Go to high ground or as far inland as you can.',
      'Go on foot if you can. Roads may be jammed or damaged.',
      'If you feel strong shaking near the coast, leave right away. Do not wait for an official warning.',
      'If you cannot reach high ground, go to an upper floor of a tall, sturdy concrete building as a last resort.',
      'Stay away from the coast. A tsunami is a series of waves, and the first wave may not be the largest.',
      'Stay where you are until officials say it is safe to return.',
    ],
    moveNote: 'Move now. Choose higher ground and distance from the water over the closest place.',
    now: ['Go to high ground or far inland now', 'Go on foot if you can'],
    cards: [
      { icon: 'close', text: 'Stay away from the beach until officials say it’s safe' },
      { icon: 'water', text: 'More waves are coming. The first may not be the biggest' },
      { icon: 'business', text: 'Can’t get high? Go to an upper floor of a tall concrete building' },
      { icon: 'walk', text: 'Felt strong shaking by the coast? Leave without waiting' },
    ],
    simShort: 'Tsunami expected',
    goPrefix: 'Go now to',
    preferred: ['shelter', 'hospital', 'meeting'],
    avoid: ['open_area'],
    simRadius: { lat: 0.015, lng: 0.02 },
  },
  flood: {
    label: 'Flood',
    icon: 'water',
    simTitle: 'Flash Flood Warning (SIMULATED)',
    simDescription: 'Flash flooding is occurring or about to occur in your area.',
    instruction: "Move to higher ground now. Never walk or drive through floodwater.",
    steps: [
      'Move to higher ground right away. Do not wait to be told.',
      "Turn around, don't drown: never walk, swim or drive through floodwater. 6 inches of moving water can knock you down, and 1 foot can sweep a car away.",
      'Stay off bridges over fast-moving water.',
      'If you are trapped in a building, go to the highest level. Do not climb into a closed attic. Go on the roof only if you must, and signal for help.',
      'If your car is caught in rising water, stay inside. If water comes inside the car, get onto the roof.',
      'Stay away from floodwater. It can hide debris and live electrical wires.',
    ],
    moveNote: 'Move now if you are in a low area. Pick higher ground over the closest place, and avoid flooded roads.',
    now: ['Move to higher ground now', 'Never walk or drive through floodwater'],
    cards: [
      { icon: 'car', text: '6 inches of moving water can knock you down. 1 foot can float a car' },
      { icon: 'home', text: 'Trapped inside? Go to the highest floor, not a closed attic' },
      { icon: 'close', text: 'Stay off bridges over fast-moving water' },
      { icon: 'warning', text: 'Floodwater can hide debris and live wires' },
    ],
    simShort: 'Flash flooding',
    goPrefix: 'Go now to',
    preferred: ['shelter', 'hospital', 'meeting'],
    avoid: [],
    simRadius: { lat: 0.012, lng: 0.02 },
  },
  wildfire: {
    label: 'Wildfire',
    icon: 'flame',
    simTitle: 'Wildfire Evacuation Order (SIMULATED)',
    simDescription: 'A fast-moving wildfire is approaching. Evacuation has been ordered for this area.',
    instruction: 'Evacuate now. Follow official evacuation routes and stay away from the fire.',
    steps: [
      'Leave immediately when told to evacuate. Do not wait to see the fire.',
      'Follow official evacuation routes. Fires can change direction quickly.',
      'Wear an N95 mask if you have one to protect your lungs from smoke.',
      'Close the windows and doors behind you, and keep your car windows up with the air on recirculate.',
      'If you are trapped, call 911 and tell them where you are. Turn on lights so rescuers can find you.',
      'Stay away from the fire area until officials say it is safe. Do not stop to watch.',
    ],
    moveNote: 'Leave now, away from the fire and smoke. Avoid parks and open land with dry brush.',
    now: ['Leave now if told to evacuate', 'Follow official evacuation routes'],
    cards: [
      { icon: 'flame', text: 'Fires change direction fast. Don’t stop to watch' },
      { icon: 'medkit', text: 'Wear an N95 mask if you have one' },
      { icon: 'car', text: 'Close windows. Car air on recirculate' },
      { icon: 'call', text: 'Trapped? Call 911 and say where you are' },
    ],
    simShort: 'Fast-moving wildfire',
    goPrefix: 'Go now to',
    preferred: ['shelter', 'hospital', 'meeting'],
    avoid: ['open_area'],
    simRadius: { lat: 0.025, lng: 0.035 },
  },
  hurricane: {
    label: 'Hurricane',
    icon: 'thunderstorm',
    simTitle: 'Hurricane Warning (SIMULATED)',
    simDescription: 'Hurricane conditions are expected. Destructive winds, storm surge and flooding are possible.',
    instruction: 'Evacuate if ordered. Otherwise shelter in an interior room away from windows.',
    steps: [
      'If officials order an evacuation, leave immediately and follow official routes.',
      'If you are staying, go to a small interior room, closet or hallway on the lowest floor that is not at risk of flooding.',
      'Stay away from windows and glass doors.',
      'Do not go outside during the calm eye of the storm. The wind returns quickly from the other direction.',
      'Never walk or drive through floodwater, and stay away from downed power lines.',
      'Never use a generator indoors. It can cause deadly carbon monoxide poisoning.',
    ],
    moveNote: 'Travel only if you are ordered to evacuate, and go before the storm arrives. Otherwise stay sheltered indoors.',
    now: ['Leave now if told to evacuate', 'Staying? Go to a small interior room'],
    cards: [
      { icon: 'close', text: 'Stay away from windows and glass doors' },
      { icon: 'warning', text: 'A calm eye passes fast. Stay inside until it’s over' },
      { icon: 'water', text: 'Never walk or drive through floodwater' },
      { icon: 'flash-off', text: 'Never run a generator indoors' },
    ],
    simShort: 'Hurricane conditions expected',
    goPrefix: 'If evacuating: go to',
    preferred: ['shelter', 'hospital'],
    avoid: ['open_area'],
    simRadius: { lat: 0.08, lng: 0.12 },
  },
  tornado: {
    label: 'Tornado',
    icon: 'cloudy',
    simTitle: 'Tornado Warning (SIMULATED)',
    simDescription: 'A tornado has been spotted or detected on radar near you. Take shelter now.',
    instruction: 'Take shelter now on the lowest floor, in an interior room away from windows.',
    steps: [
      'Go now to a basement, storm cellar, or the lowest floor of a sturdy building.',
      'Get into an interior room without windows, such as a bathroom, closet or hallway.',
      'Stay away from windows, doors and outside walls.',
      'Get down low and cover your head and neck with your arms, or with a mattress, blankets or a helmet.',
      'Cars and mobile homes are not safe. Get to the nearest sturdy building. If you cannot, lie flat in a ditch or low spot and cover your head. Never shelter under a highway overpass.',
      'Stay sheltered until the warning has expired.',
    ],
    moveNote: 'If you are already in a sturdy building, stay there. Only travel if you are outdoors, in a car or a mobile home and a shelter is a few minutes away.',
    now: ['Go to a basement or lowest floor now', 'Get into a room with no windows'],
    cards: [
      { icon: 'arrow-down', text: 'Get low. Cover your head and neck' },
      { icon: 'close', text: 'Stay away from windows, doors and outside walls' },
      { icon: 'car', text: 'In a car or mobile home? Get to a sturdy building' },
      { icon: 'warning', text: 'Never shelter under a highway overpass' },
    ],
    simShort: 'Tornado spotted nearby',
    goPrefix: 'Need shelter? Go to',
    preferred: ['shelter', 'hospital'],
    avoid: ['open_area', 'meeting'],
    simRadius: { lat: 0.006, lng: 0.03 },
  },
};

/** Guidance for someone outside the affected area. */
/** Alert screen when you're outside the affected area: short bullets for the "Stay ready" card. */
export const OUTSIDE_NOW = ['Check on your group', 'Don’t travel into the affected area', 'Keep your phone charged'];

export const OUTSIDE_STEPS = [
  'You are outside the affected area right now. Stay alert, because conditions can change.',
  'Check on your group and ask everyone to mark themselves safe.',
  'Do not travel into the affected area unless you are told to.',
  'Keep your phone charged and follow updates from local officials.',
];

export const OFFICIAL_NOTE = 'Always follow instructions from local officials. In an emergency, call 911.';

/**
 * Best place to head for this hazard: the nearest safe area (or the meeting place) of the most
 * preferred type, skipping types that are dangerous for this hazard. Null if nothing suitable.
 */
export function pickSafeTarget(hazard: HazardType, from: LatLng, group: Group | null): Place | null {
  if (!group) return null;
  const { preferred, avoid } = HAZARDS[hazard];
  const candidates: Place[] = [...group.safeAreas];
  if (group.meetingPlace) candidates.push(group.meetingPlace);
  // [UI] Never pick a place too far to walk to (e.g. a meeting point in another city).
  const usable = candidates.filter((p) => !avoid.includes(p.type) && !tooFarToWalk(from, p.coord));
  if (!usable.length) return null;

  const rank = (p: Place) => {
    const i = preferred.indexOf(p.type);
    return i === -1 ? preferred.length : i;
  };
  return usable.reduce((best, p) => {
    const rb = rank(best), rp = rank(p);
    if (rp !== rb) return rp < rb ? p : best;
    return distanceM(from, p.coord) < distanceM(from, best.coord) ? p : best;
  });
}

/** True when the meeting place is a reasonable destination for this hazard. */
export function meetingPlaceOk(hazard: HazardType): boolean {
  return !HAZARDS[hazard].avoid.includes('meeting');
}

/** A 16-point ellipse around `center`, sized for the hazard. */
export function simulatedArea(hazard: HazardType, center: LatLng): LatLng[] {
  const { lat, lng } = HAZARDS[hazard].simRadius;
  const ring: LatLng[] = [];
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * 2 * Math.PI;
    ring.push({ latitude: center.latitude + lat * Math.sin(t), longitude: center.longitude + lng * Math.cos(t) });
  }
  return ring;
}
