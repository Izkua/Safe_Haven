import { beforeEach, expect, jest, test } from '@jest/globals';
import { checkAlerts, hazardFromNwsEvent, parseNwsAlerts, parseUsgsQuakes } from './alerts';
import type { LatLng } from '@/types';

jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}) },
}));

const NOW = Date.parse('2026-10-18T02:00:00Z');
const SEATTLE: LatLng = { latitude: 47.6553, longitude: -122.3035 };

// Shapes copied from live api.weather.gov / earthquake.usgs.gov responses (trimmed).
const nwsFeature = (over: Record<string, unknown> = {}, geometry: unknown = null) => ({
  id: 'https://api.weather.gov/alerts/x',
  geometry,
  properties: {
    id: 'urn:oid:flood-1',
    event: 'Flood Warning',
    headline: 'Flood Warning issued October 17 by NWS Seattle WA',
    description: 'River flooding is expected.',
    instruction: 'Move to higher ground.',
    severity: 'Severe',
    status: 'Actual',
    messageType: 'Alert',
    sent: '2026-10-17T21:06:00-04:00',
    expires: '2026-10-18T21:15:00-04:00',
    ends: null,
    references: [],
    ...over,
  },
});

const quake = (id: string, mag: number, lat: number, lng: number, time = NOW - 5 * 60_000) => ({
  id,
  properties: { mag, place: '10 km N of Somewhere', time, tsunami: 0 },
  geometry: { type: 'Point', coordinates: [lng, lat, 10] },
});

test('NWS: keeps Severe/Extreme, drops advisories, tests, cancels and expired', () => {
  const alerts = parseNwsAlerts(
    {
      features: [
        nwsFeature(),
        nwsFeature({ id: 'adv', event: 'Small Craft Advisory', severity: 'Minor' }),
        nwsFeature({ id: 'frost', event: 'Frost Advisory', severity: 'Moderate' }),
        nwsFeature({ id: 'test', event: 'Test Message', status: 'Test' }),
        nwsFeature({ id: 'cancel', messageType: 'Cancel' }),
        nwsFeature({ id: 'old', expires: '2026-10-17T00:00:00Z' }),
        // Rated Severe by NWS but not a danger to people on land:
        nwsFeature({ id: 'freeze', event: 'Freeze Warning' }),
        nwsFeature({ id: 'marine', event: 'Special Marine Warning' }),
        nwsFeature({ id: 'gale', event: 'Gale Warning' }),
        nwsFeature({ id: 'storm', event: 'Storm Watch' }),
      ],
    },
    NOW,
  );
  expect(alerts.map((a) => a.id)).toEqual(['nws:urn:oid:flood-1']);
  expect(alerts[0]).toMatchObject({ source: 'nws', hazard: 'flood', severity: 'severe', title: 'Flood Warning', instruction: 'Move to higher ground.' });
});

test('NWS: polygon coordinates are flipped from [lng, lat]', () => {
  const ring = [[-122.4, 47.6], [-122.2, 47.6], [-122.2, 47.7], [-122.4, 47.6]];
  const [a] = parseNwsAlerts({ features: [nwsFeature({}, { type: 'Polygon', coordinates: [ring] })] }, NOW);
  expect(a.areas[0][0]).toEqual({ latitude: 47.6, longitude: -122.4 });
});

test('NWS event names map to our hazard types', () => {
  expect(hazardFromNwsEvent('Tornado Warning')).toBe('tornado');
  expect(hazardFromNwsEvent('Flash Flood Emergency')).toBe('flood');
  expect(hazardFromNwsEvent('Typhoon Warning')).toBe('hurricane');
  expect(hazardFromNwsEvent('Tsunami Warning')).toBe('tsunami');
  expect(hazardFromNwsEvent('Fire Warning')).toBe('wildfire');
  expect(hazardFromNwsEvent('Red Flag Warning')).toBeUndefined();
  expect(hazardFromNwsEvent('High Wind Warning')).toBeUndefined();
});

test('NWS: land storms are kept even though marine "Storm Watch" is ignored', () => {
  const alerts = parseNwsAlerts(
    { features: ['Tropical Storm Warning', 'Winter Storm Warning', 'High Wind Warning'].map((event, i) => nwsFeature({ id: `s${i}`, event })) },
    NOW,
  );
  expect(alerts.map((a) => a.title)).toEqual(['Tropical Storm Warning', 'Winter Storm Warning', 'High Wind Warning']);
});

test('USGS: only M4+ within 150 km in the last hour', () => {
  const alerts = parseUsgsQuakes(
    {
      features: [
        quake('near-big', 5.2, 47.7, -122.3),
        quake('near-small', 3.1, 47.7, -122.3),
        quake('far', 6.5, -6.5, 146.0),
        quake('stale', 5.0, 47.7, -122.3, NOW - 2 * 60 * 60_000),
      ],
    },
    SEATTLE,
    NOW,
  );
  expect(alerts.map((a) => a.id)).toEqual(['usgs:near-big']);
  expect(alerts[0]).toMatchObject({ hazard: 'earthquake', severity: 'severe', title: 'M5.2 earthquake', center: { latitude: 47.7, longitude: -122.3 } });
});

test('checkAlerts: most severe first, and an alert (or its update) only pops up once', async () => {
  const realNow = Date.now();
  const nws = { features: [nwsFeature({ id: 'urn:live-1', sent: new Date(realNow).toISOString(), expires: new Date(realNow + 3_600_000).toISOString() })] };
  const usgs = { features: [quake('big-one', 6.1, 47.7, -122.3, realNow - 60_000)] };
  const respond = (body: unknown) => Promise.resolve({ ok: true, json: async () => body } as Response);
  const fetchMock = jest.fn((url: string) => respond(url.includes('weather.gov') ? nws : usgs));
  global.fetch = fetchMock as unknown as typeof fetch;

  const first = await checkAlerts(SEATTLE);
  expect(first.map((a) => a.id)).toEqual(['usgs:big-one', 'nws:urn:live-1']); // extreme before severe

  const second = await checkAlerts(SEATTLE);
  expect(second.map((a) => a.id)).toEqual(['nws:urn:live-1']); // the quake was shown; the flood is next

  // An NWS update that replaces the shown flood warning stays quiet.
  nws.features = [nwsFeature({ id: 'urn:live-1-update', messageType: 'Update', references: [{ identifier: 'urn:live-1' }], expires: new Date(realNow + 3_600_000).toISOString() })];
  expect(await checkAlerts(SEATTLE)).toEqual([]);
});

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
