import { expect, test } from '@jest/globals';
import { destinationPatch, isHazard, savedHaven, usualMeetingPoint, withSavedHaven } from './havens';
import type { Group, Place } from '@/types';
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
