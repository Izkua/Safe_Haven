import { expect, test } from '@jest/globals';
import { isHazard, savedHaven, withSavedHaven } from './havens';
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
