// [OWNER: UI] One announcement: sender avatar, name and time, a bold headline, and an optional
// italic details line. Used in the banner and in the Group screen's recent list, where it also
// says who has seen it (dismissed the banner) and who hasn't.
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { ackSummary, announcementTime } from '@/lib/announcements';
import { useApp } from '@/state/AppContext';
import { colors, memberColor } from '@/theme';
import type { Announcement } from '@/types';

export function AnnouncementCard({ a, showGroup = true, showSeen = false }: { a: Announcement; showGroup?: boolean; showSeen?: boolean }) {
  const { groups, members, myUid } = useApp().state;
  const group = groups.find((g) => g.id === a.groupId);
  const mine = a.senderId === myUid;
  const initial = Array.from(a.senderName.trim())[0]?.toUpperCase() ?? '?';
  const groupName = group?.name ?? a.groupName;
  const seenLine = showSeen && group ? seenText(ackSummary(a, group.memberIds, Object.fromEntries(members.map((m) => [m.uid, m.name])), myUid)) : null;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${mine ? 'You' : a.senderName} announced${showGroup && groupName ? ` to ${groupName}` : ''}, ${announcementTime(a.sentAt)}: ${a.title}${a.details ? `. ${a.details}` : ''}${seenLine ? `. ${seenLine}` : ''}`}
    >
      <View style={[styles.avatar, { backgroundColor: memberColor(a.senderId, group?.memberIds ?? []) }]}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.meta} numberOfLines={1}>
          <Text style={styles.name}>{mine ? 'You' : a.senderName}</Text>
          <Text style={styles.time}>{`  ${announcementTime(a.sentAt)}`}{showGroup && groupName ? `  to ${groupName}` : ''}</Text>
        </Text>
        <Text style={styles.title}>{a.title}</Text>
        {!!a.details && <Text style={styles.details}>{a.details}</Text>}
        {!!seenLine && (
          <View style={styles.seen}>
            <Ionicons name="checkmark-done" size={16} color={colors.muted} />
            <Text style={styles.seenText}>{seenLine}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** "Seen by Mom, waiting on Sis". Null when nobody else is in the group. */
function seenText({ seen, waiting }: { seen: string[]; waiting: string[] }): string | null {
  if (!seen.length && !waiting.length) return null;
  if (!waiting.length) return 'Seen by everyone';
  if (!seen.length) return `Not seen yet, waiting on ${waiting.join(', ')}`;
  return `Seen by ${seen.join(', ')}, waiting on ${waiting.join(', ')}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 18, fontWeight: '700', color: colors.onDanger },
  text: { flex: 1, gap: 2 },
  meta: { fontSize: 15, lineHeight: 20 },
  name: { fontWeight: '600', color: colors.text },
  time: { fontSize: 13, color: colors.muted },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.text },
  details: { fontSize: 16, lineHeight: 22, fontStyle: 'italic', color: colors.muted },
  seen: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  seenText: { flex: 1, fontSize: 14, lineHeight: 19, color: colors.muted },
});
