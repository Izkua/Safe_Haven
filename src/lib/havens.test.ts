import { expect, test } from '@jest/globals';
import { destinationPatch, endDrillDestination, isHazard, savedHaven, usualMeetingPoint, withSavedHaven } from './havens';
import type { Group, HazardAlert, Place } from '@/types';
const old: Place = { id: 'meet', name: 'Current meeting', coord: { latitude: 47, longitude: -122 }, type: 'meeting' };
const haven: Place = { ...old, id: 'haven-earthquake', name: 'Open field' };
const family: Group = { id: 'family', name: 'Family', inviteCode: 'ABCDEF', memberIds: ['me'], meetingPlace: old, safeAreas: [] };
test('preparing a haven preserves the active meeting point and other disasters', () => {
  const prepared = withSavedHaven(withSavedHaven(family, 'flood', { ...haven, name: 'High ground' }), 'earthquake', haven);
  expect(prepared.meetingPlace).toEqual(old);
  expect(savedHaven(prepared, 'earthquake')?.name).toBe('Open field');
  expect(savedHaven(prepared, 'flood')?.name).toBe('High ground');
  expect(family.disasterHavens).toBeUndefined();
});
test('each group keeps an independent choice for the same disaster', () => {
  const a = withSavedHaven(family, 'earthquake', haven);
  const b = withSavedHaven({ ...family, id: 'friends' }, 'earthquake', { ...haven, name: 'Park' });
  expect(savedHaven(a, 'earthquake')?.name).toBe('Open field');
  expect(savedHaven(b, 'earthquake')?.name).toBe('Park');
  expect(savedHaven(b, 'tsunami')).toBeNull();
});
test('missing and malformed saved choices do not become suggested destinations', () => {
  expect(savedHaven(null, 'earthquake')).toBeNull();
  expect(savedHaven(withSavedHaven(family, 'earthquake', { ...haven, coord: { latitude: NaN, longitude: 0 } }), 'earthquake')).toBeNull();
  expect(savedHaven(withSavedHaven(family, 'earthquake', { ...haven, coord: { latitude: 91, longitude: 0 } }), 'earthquake')).toBeNull();
  expect(isHazard('earthquake')).toBe(true);
  expect(isHazard('unknown')).toBe(false);
});

test('switching between havens keeps the original usual point and can restore it', () => {
  const earthquake = { ...family, ...destinationPatch(family, haven, 'earthquake') };
  const floodPlace = { ...haven, name: 'High ground' };
  const flood = { ...earthquake, ...destinationPatch(earthquake, floodPlace, 'flood') };
  expect(flood.meetingPlace?.name).toBe('High ground');
  expect(usualMeetingPoint(flood)).toEqual(old);
  const restored = { ...flood, ...destinationPatch(flood, usualMeetingPoint(flood)!, null) };
  expect(restored.meetingPlace).toEqual(old);
  expect(restored.activeHaven).toBeNull();
  expect(usualMeetingPoint(restored)).toEqual(old);
});
test('switching never invents a usual point when none was set', () => {
  const activated = { ...family, ...destinationPatch({ ...family, meetingPlace: null }, haven, 'earthquake') };
  expect(usualMeetingPoint(activated)).toBeNull();
});
test('a new normal meeting point becomes the usual point even during haven mode', () => {
  const activated = { ...family, ...destinationPatch(family, haven, 'earthquake') };
  const newUsual = { ...old, name: 'New usual point' };
  const changed = { ...activated, ...destinationPatch(activated, newUsual, null) };
  expect(changed.activeHaven).toBeNull();
  expect(usualMeetingPoint(changed)).toEqual(newUsual);
});

const floodAlert: HazardAlert = { id: 'drill-1', source: 'simulated', groupId: family.id, hazard: 'flood', title: 'Flood drill', description: '', instruction: null, severity: 'extreme', areas: [], center: null, issuedAt: 1, expiresAt: null };
test('ending the flood drill restores the usual point and keeps the haven for a later drill', () => {
  const prepared = withSavedHaven(family, 'flood', haven);
  const active = { ...prepared, ...destinationPatch(prepared, haven, 'flood') };
  const patch = endDrillDestination(active, floodAlert);
  expect(patch).not.toBeNull();
  const ended = { ...active, ...patch };
  expect(ended.meetingPlace).toEqual(old);
  expect(ended.activeHaven).toBeNull();
  expect(savedHaven(ended, 'flood')).toEqual(haven);
  const later = { ...ended, ...destinationPatch(ended, savedHaven(ended, 'flood')!, 'flood') };
  expect(later.meetingPlace).toEqual(haven);
  expect(usualMeetingPoint(later)).toEqual(old);
});
test('ending a drill with no usual point clears the active haven but retains its saved location', () => {
  const prepared = withSavedHaven({ ...family, meetingPlace: null }, 'flood', haven);
  const active = { ...prepared, ...destinationPatch(prepared, haven, 'flood') };
  const ended = { ...active, ...endDrillDestination(active, floodAlert) };
  expect(ended.meetingPlace).toBeNull();
  expect(ended.activeHaven).toBeNull();
  expect(savedHaven(ended, 'flood')).toEqual(haven);
});
test('ending a drill preserves a custom meeting point set during it', () => {
  const active = { ...family, ...destinationPatch(family, haven, 'flood') };
  const custom = { ...old, name: 'New custom point' };
  const changed = { ...active, ...destinationPatch(active, custom, null) };
  expect(endDrillDestination(changed, floodAlert)).toBeNull();
  expect(changed.meetingPlace).toEqual(custom);
});
test('dismissing a real alert or another group or hazard never restores this haven', () => {
  const active = { ...family, ...destinationPatch(family, haven, 'flood') };
  expect(endDrillDestination(active, { ...floodAlert, source: 'nws' })).toBeNull();
  expect(endDrillDestination(active, { ...floodAlert, groupId: 'other' })).toBeNull();
  expect(endDrillDestination(active, { ...floodAlert, hazard: 'earthquake' })).toBeNull();
});
