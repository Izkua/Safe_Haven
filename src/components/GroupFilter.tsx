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
};

export function GroupFilter({ groups, visibleIds, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  if (!groups.length) return null;
  // Name the groups that are on, so it's obvious at a glance whose pins are showing.
  const shown = groups.filter((g) => visibleIds.includes(g.id)).map((g) => g.name);
  const summary = shown.length ? shown.join(', ') : 'No groups shown';

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.button} onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Ionicons name="people" size={16} color={colors.text} />
        <Text style={styles.buttonText} numberOfLines={1}>{summary}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text} />
      </Pressable>
      {open && (
        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Show on map</Text>
          {groups.map((g) => {
            const on = visibleIds.includes(g.id);
            return (
              <Pressable key={g.id} style={styles.row} onPress={() => onToggle(g.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.muted} />
                <Text style={styles.rowText} numberOfLines={1}>{g.name}</Text>
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
});
