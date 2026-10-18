import { describe, expect, it } from '@jest/globals';
import { HAZARD_TYPES, HAZARDS, pickSafeTarget, simulatedArea } from '@/lib/hazards';
import { DEMO_GROUP, makeSimulatedAlert, UW_CENTER } from '@/mocks/demo';
import { isUserAffected } from '@/services/alerts';
import type { Group } from '@/types';

describe('simulated alerts', () => {
  it.each(HAZARD_TYPES)('%s alert covers the user and carries steps', (hazard) => {
    const a = makeSimulatedAlert(UW_CENTER, hazard);
    expect(a.hazard).toBe(hazard);
    expect(isUserAffected(a, UW_CENTER)).toBe(true);
    expect(HAZARDS[hazard].steps.length).toBeGreaterThanOrEqual(3);
  });

  it('a point far away is outside the simulated area', () => {
    const a = makeSimulatedAlert(UW_CENTER, 'tornado');
    expect(isUserAffected(a, { latitude: UW_CENTER.latitude + 0.5, longitude: UW_CENTER.longitude })).toBe(false);
  });

  it('area is a closed-able ring around the center', () => {
    expect(simulatedArea('flood', UW_CENTER)).toHaveLength(16);
  });
});

describe('pickSafeTarget', () => {
  it('earthquake prefers an open area', () => {
    expect(pickSafeTarget('earthquake', UW_CENTER, DEMO_GROUP)?.type).toBe('open_area');
  });

  it('tornado never suggests an open area or the meeting place', () => {
    const t = pickSafeTarget('tornado', UW_CENTER, DEMO_GROUP);
    expect(t?.type).toBe('shelter');
  });

  it('returns null when only unsafe places exist', () => {
    const g: Group = { ...DEMO_GROUP, meetingPlace: null, safeAreas: DEMO_GROUP.safeAreas.filter((p) => p.type === 'open_area') };
    expect(pickSafeTarget('wildfire', UW_CENTER, g)).toBeNull();
  });

  it('falls back to the meeting place when there are no safe areas', () => {
    const g: Group = { ...DEMO_GROUP, safeAreas: [] };
    expect(pickSafeTarget('flood', UW_CENTER, g)?.id).toBe('meet');
  });
});
