// [OWNER: SYNC] Pure helpers for being in several groups at once.
import type { Group, Member } from '@/types';

/** Insert or replace `g` (by id), keeping order. */
export function upsertGroup(groups: Group[], g: Group): Group[] {
  const i = groups.findIndex((x) => x.id === g.id);
  if (i === -1) return [...groups, g];
  const next = groups.slice();
  next[i] = g;
  return next;
}

/** Union of member ids across groups, each id once. First group's order wins (stable pin colors). */
export function allMemberIds(groups: Group[]): string[] {
  const seen = new Set<string>();
  for (const g of groups) for (const id of g.memberIds) seen.add(id);
  return [...seen];
}

/** One entry per person, even if they share several groups with you. Last write wins. */
export function dedupeMembers(members: Member[]): Member[] {
  const byUid = new Map<string, Member>();
  for (const m of members) byUid.set(m.uid, m);
  return [...byUid.values()];
}

/** Members who belong to at least one of the visible groups, each person once. */
export function visibleMembers(members: Member[], groups: Group[], visibleGroupIds: string[]): Member[] {
  const visible = new Set<string>();
  for (const g of groups) if (visibleGroupIds.includes(g.id)) for (const id of g.memberIds) visible.add(id);
  return dedupeMembers(members).filter((m) => visible.has(m.uid));
}
