import { expect, test } from '@jest/globals';
import { requestMapFocus, takeMapFocus } from '@/lib/mapFocus';

const place = { id: 'meet-g1', name: 'Lawn', coord: { latitude: 1, longitude: 2 }, type: 'meeting' as const };

test('keeps only the latest request and hands it out once', () => {
  expect(takeMapFocus()).toBeNull();
  requestMapFocus({ place, label: 'Family' });
  requestMapFocus({ place, label: 'Roommates' });
  expect(takeMapFocus()?.label).toBe('Roommates');
  expect(takeMapFocus()).toBeNull();
});
