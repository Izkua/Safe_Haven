import { describe, expect, it } from '@jest/globals';
import { allMemberIds, dedupeMembers, upsertGroup, visibleMembers } from '@/lib/groups';
import type { Group, Member } from '@/types';

const g = (id: string, memberIds: string[]): Group => ({ id, name: id, inviteCode: id.toUpperCase(), memberIds, meetingPlace: null, safeAreas: [] });
const m = (uid: string): Member => ({ uid, name: uid, location: { latitude: 0, longitude: 0 }, locationTs: 1, status: 'unknown' });

const family = g('family', ['me', 'mom', 'sis']);
const roommates = g('roommates', ['me', 'sis', 'alex']);

describe('groups helpers', () => {
  it('upsertGroup replaces by id and appends new ones', () => {
    const renamed = { ...family, name: 'Fam' };
    expect(upsertGroup([family, roommates], renamed).map((x) => x.name)).toEqual(['Fam', 'roommates']);
    expect(upsertGroup([family], roommates)).toHaveLength(2);
  });

  it('allMemberIds lists shared members once', () => {
    expect(allMemberIds([family, roommates])).toEqual(['me', 'mom', 'sis', 'alex']);
  });

  it('dedupeMembers keeps one pin per person', () => {
    expect(dedupeMembers([m('sis'), m('mom'), m('sis')]).map((x) => x.uid)).toEqual(['sis', 'mom']);
  });

  it('visibleMembers shows a shared member once when both groups are on', () => {
    const all = [m('mom'), m('sis'), m('alex'), m('sis')];
    expect(visibleMembers(all, [family, roommates], ['family', 'roommates']).map((x) => x.uid).sort()).toEqual(['alex', 'mom', 'sis']);
  });

  it('visibleMembers hides people only in hidden groups', () => {
    const all = [m('mom'), m('sis'), m('alex')];
    expect(visibleMembers(all, [family, roommates], ['roommates']).map((x) => x.uid).sort()).toEqual(['alex', 'sis']);
    expect(visibleMembers(all, [family, roommates], [])).toEqual([]);
  });
});
