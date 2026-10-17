import { expect, test } from '@jest/globals';
import { bearingDeg, distanceM, lngLatToTile, nearestPlace, pointInPolygon, tilesForRegion } from './geo';

const seattle = { latitude: 47.6062, longitude: -122.3321 };
const portland = { latitude: 45.5152, longitude: -122.6784 };

test('distanceM Seattle → Portland ≈ 233 km', () => {
  const km = distanceM(seattle, portland) / 1000;
  expect(km).toBeGreaterThan(230);
  expect(km).toBeLessThan(237);
});

test('bearingDeg cardinal directions', () => {
  const o = { latitude: 0, longitude: 0 };
  expect(bearingDeg(o, { latitude: 1, longitude: 0 })).toBeCloseTo(0);
  expect(bearingDeg(o, { latitude: 0, longitude: 1 })).toBeCloseTo(90);
  expect(bearingDeg(o, { latitude: -1, longitude: 0 })).toBeCloseTo(180);
  expect(bearingDeg(o, { latitude: 0, longitude: -1 })).toBeCloseTo(270);
});

test('pointInPolygon square', () => {
  const sq = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 1, longitude: 1 },
    { latitude: 1, longitude: 0 },
  ];
  expect(pointInPolygon({ latitude: 0.5, longitude: 0.5 }, sq)).toBe(true);
  expect(pointInPolygon({ latitude: 1.5, longitude: 0.5 }, sq)).toBe(false);
});

test('nearestPlace picks closest', () => {
  const places = [
    { id: 'p', name: 'Portland', coord: portland, type: 'shelter' as const },
    { id: 's', name: 'Seattle', coord: seattle, type: 'shelter' as const },
  ];
  expect(nearestPlace({ latitude: 47.5, longitude: -122.3 }, places)?.id).toBe('s');
});

test('tile math', () => {
  expect(lngLatToTile({ latitude: 0.1, longitude: 0.1 }, 1)).toEqual({ x: 1, y: 0 });
  const tiles = tilesForRegion(seattle, 3, 12, 14);
  expect(tiles.length).toBeGreaterThan(0);
  expect(tiles.every((t) => t.z >= 12 && t.z <= 14)).toBe(true);
});
