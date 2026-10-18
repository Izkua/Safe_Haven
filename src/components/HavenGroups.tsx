import { ScrollView, Pressable, Text } from 'react-native';
import { colors, radius } from '@/theme';
import type { Group } from '@/types';
export function HavenGroups({ groups, selected, onSelect }: { groups: Group[]; selected: string; onSelect: (id: string) => void }) {
  return <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
    {groups.map(g => <Pressable key={g.id} accessibilityRole="button" accessibilityState={{ selected: selected === g.id }} onPress={() => onSelect(g.id)}
      style={{ padding: 16, borderRadius: radius, backgroundColor: selected === g.id ? colors.primary : colors.card }}>
      <Text style={{ color: selected === g.id ? colors.onPrimary : colors.text, fontWeight: '700' }}>{g.name}</Text>
    </Pressable>)}
  </ScrollView>;
}
