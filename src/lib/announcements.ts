// [OWNER: UI] Pure helpers for announcements (tested in announcements.test.ts).
import type { Announcement } from '@/types';

/** How many announcements the phone keeps. */
export const KEEP_ANNOUNCEMENTS = 10;
/** Only announcements newer than this raise a banner/notification (older ones are just history). */
export const BANNER_FRESH_MS = 24 * 60 * 60_000;
/** Slack for the sender's clock: sent up to this long before you joined still counts as new. */
export const JOIN_GRACE_MS = 60_000;
/** Character limits (firestore.rules enforces the same). */
export const TITLE_MAX = 140;
export const DETAILS_MAX = 500;
/** Cap on remembered ids, so the list on disk can't grow forever. */
export const SEEN_CAP = 200;

export type SavedAnnouncement = Announcement & { dismissed: boolean };

/**
 * Folds newly fetched announcements into the saved list.
 * - Never seen before + from someone else + recent → saved undismissed (banner + notification).
 * - Your own, old ones, or ones sent before this phone joined that group (`joinedAt`) → saved as
 *   already dismissed (history only), so joining a group doesn't pop up its past announcements.
 * Returns the newest KEEP_ANNOUNCEMENTS, the updated seen ids, and which ones should alert now.
 */
export function mergeAnnouncements(
  saved: SavedAnnouncement[],
  seen: string[],
  incoming: Announcement[],
  myUid: string | null,
  now: number = Date.now(),
  joinedAt: Record<string, number> = {},
): { saved: SavedAnnouncement[]; seen: string[]; alerts: SavedAnnouncement[] } {
  const seenSet = new Set(seen);
  const added: SavedAnnouncement[] = [];
  // Ones we already keep only pick up new "seen" acks (merged, so a local ack isn't lost).
  saved = saved.map((s) => {
    const fresh = incoming.find((a) => a.id === s.id);
    if (!fresh?.ackedBy?.length) return s;
    return { ...s, ackedBy: [...new Set([...(s.ackedBy ?? []), ...fresh.ackedBy])] };
  });
  for (const a of incoming) {
    if (seenSet.has(a.id) || saved.some((s) => s.id === a.id)) continue;
    seenSet.add(a.id);
    const fromOther = a.senderId !== myUid;
    const fresh = now - a.sentAt < BANNER_FRESH_MS && a.sentAt >= (joinedAt[a.groupId] ?? 0) - JOIN_GRACE_MS;
    added.push({ ...a, dismissed: !(fromOther && fresh) });
  }
  const next = [...saved, ...added].sort((x, y) => y.sentAt - x.sentAt).slice(0, KEEP_ANNOUNCEMENTS);
  return {
    saved: next,
    seen: [...seenSet].slice(-SEEN_CAP),
    // Only alert for ones that made it into the kept list.
    alerts: added.filter((a) => !a.dismissed && next.some((n) => n.id === a.id)),
  };
}

/** The banner shows the newest announcement you haven't dismissed yet. */
export function bannerAnnouncement(saved: SavedAnnouncement[]): SavedAnnouncement | null {
  return saved.find((a) => !a.dismissed) ?? null;
}

/**
 * Who has seen an announcement (dismissed its banner) and who hasn't, as display names.
 * The sender is left out; you are "You". Members no longer in the group are ignored.
 */
export function ackSummary(
  a: Announcement,
  memberIds: string[],
  names: Record<string, string>,
  myUid: string | null,
): { seen: string[]; waiting: string[] } {
  const acked = new Set(a.ackedBy ?? []);
  const seen: string[] = [];
  const waiting: string[] = [];
  for (const uid of memberIds) {
    if (uid === a.senderId) continue;
    const name = uid === myUid ? 'You' : (names[uid] ?? 'Someone');
    (acked.has(uid) ? seen : waiting).push(name);
  }
  return { seen, waiting };
}

/** "12:59 AM" today, "Mon 12:59 AM" this week, otherwise "Oct 12". */
export function announcementTime(ms: number, now: number = Date.now()): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (new Date(now).toDateString() === d.toDateString()) return time;
  if (now - ms < 6 * 86_400_000) return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
