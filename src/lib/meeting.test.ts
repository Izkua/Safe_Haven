import { expect, test } from '@jest/globals';
import { meetingSetBy } from '@/lib/meeting';
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
