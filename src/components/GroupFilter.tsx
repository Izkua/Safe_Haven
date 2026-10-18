// [OWNER: MAP] Dropdown on the map: checkboxes for which groups' members are shown.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import type { Group } from '@/types';

type Props = {
  groups: Group[];
  visibleIds: string[];
  onToggle: (id: string) => void;
  /** Each group's color (same as its meeting point on the map). */
  colorFor?: (id: string) => string;
};

export function GroupFilter({ groups, visibleIds, onToggle, colorFor }: Props) {
  const [open, setOpen] = useState(false);
  if (!groups.length) return null;
  // Name the groups that are on, so it's obvious at a glance whose pins are showing.
  const shownGroups = groups.filter((g) => visibleIds.includes(g.id));
  const summary = shownGroups.length ? shownGroups.map((g) => g.name).join(', ') : 'No groups shown';

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.button} onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        {colorFor && shownGroups.length ? (
          // One dot per shown group, in its map color.
          <View style={styles.dots}>
            {shownGroups.slice(0, 4).map((g) => <View key={g.id} style={[styles.dot, { backgroundColor: colorFor(g.id) }]} />)}
          </View>
        ) : (
          <Ionicons name="people" size={16} color={colors.text} />
        )}
        <Text style={styles.buttonText} numberOfLines={1}>{summary}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text} />
      </Pressable>
      {open && (
        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Show on map</Text>
          {groups.map((g) => {
            const on = visibleIds.includes(g.id);
            const c = colorFor ? colorFor(g.id) : colors.primary;
            return (
              <Pressable key={g.id} style={styles.row} onPress={() => onToggle(g.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                {/* Checkbox in the group's own color, matching its meeting point on the map. */}
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={c} />
                <Text style={[styles.rowText, !on && { color: colors.muted }]} numberOfLines={1}>{g.name}</Text>
                <Text style={styles.count}>{g.memberIds.length}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 280 },
  buttonText: { color: colors.text, fontWeight: '700', flexShrink: 1 },
  menu: { marginTop: 6, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 6, minWidth: 200, maxWidth: 260 },
  menuTitle: { color: colors.muted, fontSize: 12, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rowText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  count: { color: colors.muted, fontSize: 12 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#FFFFFF' },
});
