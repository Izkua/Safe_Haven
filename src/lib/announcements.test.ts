import { expect, test } from '@jest/globals';
import type { Announcement } from '@/types';
import { ackSummary, bannerAnnouncement, KEEP_ANNOUNCEMENTS, mergeAnnouncements, type SavedAnnouncement } from './announcements';

const NOW = 1_000_000_000_000;
const ann = (id: string, senderId: string, minsAgo: number): Announcement => ({
  id, groupId: 'g', groupName: 'Family', title: `t-${id}`, details: '', senderId, senderName: senderId, sentAt: NOW - minsAgo * 60_000,
});

test('new announcement from someone else alerts and shows in the banner', () => {
  const r = mergeAnnouncements([], [], [ann('a', 'mom', 1)], 'me', NOW);
  expect(r.alerts.map((a) => a.id)).toEqual(['a']);
  expect(bannerAnnouncement(r.saved)?.id).toBe('a');
});

test('own and old announcements are saved as history without alerting', () => {
  const r = mergeAnnouncements([], [], [ann('mine', 'me', 1), ann('old', 'mom', 60 * 48)], 'me', NOW);
  expect(r.alerts).toEqual([]);
  expect(r.saved.map((a) => a.id)).toEqual(['mine', 'old']);
  expect(bannerAnnouncement(r.saved)).toBeNull();
});

test('already-seen announcements never alert again, even after dropping off the list', () => {
  const first = mergeAnnouncements([], [], [ann('a', 'mom', 1)], 'me', NOW);
  const again = mergeAnnouncements([], first.seen, [ann('a', 'mom', 1)], 'me', NOW);
  expect(again.alerts).toEqual([]);
  expect(again.saved).toEqual([]);
});

test('keeps only the newest five, newest first', () => {
  const incoming = Array.from({ length: 8 }, (_, i) => ann(`n${i}`, 'mom', i));
  const r = mergeAnnouncements([], [], incoming, 'me', NOW);
  expect(r.saved).toHaveLength(KEEP_ANNOUNCEMENTS);
  expect(r.saved.map((a) => a.id)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
});

test('dismissing the newest reveals the next undismissed one', () => {
  const saved: SavedAnnouncement[] = [
    { ...ann('b', 'mom', 1), dismissed: true },
    { ...ann('a', 'mom', 2), dismissed: false },
  ];
  expect(bannerAnnouncement(saved)?.id).toBe('a');
});

test('new acks on an announcement we keep are merged in, without alerting again', () => {
  const saved: SavedAnnouncement[] = [{ ...ann('a', 'me', 1), ackedBy: ['sis'], dismissed: true }];
  const r = mergeAnnouncements(saved, ['a'], [{ ...ann('a', 'me', 1), ackedBy: ['mom'] }], 'me', NOW);
  expect(r.saved[0].ackedBy?.sort()).toEqual(['mom', 'sis']);
  expect(r.alerts).toEqual([]);
});

test('ack summary leaves out the sender and names you as You', () => {
  const a = { ...ann('a', 'mom', 1), ackedBy: ['me'] };
  const r = ackSummary(a, ['mom', 'me', 'sis', 'dad'], { mom: 'Mom', sis: 'Sis' }, 'me');
  expect(r).toEqual({ seen: ['You'], waiting: ['Sis', 'Someone'] });
});
