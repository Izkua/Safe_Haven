import { expect, test } from '@jest/globals';
import { formatStreetAddress, meetingMovedNotice, meetingSetBy } from '@/lib/meeting';
import type { Place } from '@/types';

const base: Place = { id: 'meet', name: 'Front lawn', coord: { latitude: 47.65, longitude: -122.3 }, type: 'meeting' };
const now = 1_000_000_000;

test('meeting point attribution: someone else, me, and old places', () => {
  expect(meetingSetBy({ ...base, setBy: 'u2', setByName: 'Sam', setAt: now - 5 * 60_000 }, 'u1', now)).toBe('Set by Sam, 5 min ago');
  expect(meetingSetBy({ ...base, setBy: 'u1', setByName: 'Noah', setAt: now }, 'u1', now)).toBe('Set by you, just now');
  expect(meetingSetBy({ ...base, setAt: now }, 'u1', now)).toBe('Set by someone, just now');
  expect(meetingSetBy(base, 'u1', now)).toBeNull(); // saved before attribution existed
  expect(meetingSetBy(null, 'u1', now)).toBeNull();
});

test('nearest-address formatting', () => {
  expect(formatStreetAddress({ streetNumber: '4060', street: 'George Washington Ln NE', city: 'Seattle' })).toBe('4060 George Washington Ln NE, Seattle');
  expect(formatStreetAddress({ name: 'Drumheller Fountain', city: 'Seattle' })).toBe('Drumheller Fountain, Seattle');
  expect(formatStreetAddress({ street: 'NE 45th St' })).toBe('NE 45th St');
  expect(formatStreetAddress({ city: 'Seattle' })).toBe('Seattle');
  expect(formatStreetAddress({})).toBeNull();
  expect(formatStreetAddress(null)).toBeNull();
});

test('meeting point moved notification', () => {
  const place = { ...base, name: 'Front lawn', setByName: 'Sam', setAt: now };
  expect(meetingMovedNotice('Family', place, '4060 George Washington Ln NE, Seattle')).toEqual({
    title: 'Family: meeting point "Front lawn" moved',
    body: 'Sam set it to 4060 George Washington Ln NE, Seattle.',
  });
  // No address found: coordinates rather than nothing.
  expect(meetingMovedNotice('Family', place, null).body).toBe('Sam set it to 47.6500, -122.3000.');
});
