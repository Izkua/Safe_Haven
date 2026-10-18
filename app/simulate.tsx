// Disaster-specific preparation stays separate from the group's active meeting point.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { HavenGroups } from '@/components/HavenGroups';
import { HAZARD_TYPES, HAZARDS } from '@/lib/hazards';
import { savedHaven } from '@/lib/havens';
import { useApp } from '@/state/AppContext';
import { colors, radius } from '@/theme';
import type { HazardType } from '@/types';
export default function SimulateScreen() {
  const { state, actions } = useApp();
  const [selected, select] = useState(state.activeGroupId ?? '');
  const group = state.groups.find(g => g.id === selected) ?? state.groups[0];
  const [hazard, setHazard] = useState<HazardType>('earthquake');
  // Android draws under the system navigation bar: keep the last line above it.
  const { bottom } = useSafeAreaInsets();
  const simulate = () => {
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
    void actions.startDrill(hazard, group?.id);
  };
  return <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 20 + bottom, gap: 12 }}>
    <Text style={styles.hint}>Choose a group, then a disaster to prepare a haven. Your current meeting point stays unchanged until you use the suggestion.</Text>
    <HavenGroups groups={state.groups} selected={group?.id ?? ''} onSelect={select} />
    {!group && <Text style={styles.hint}>Join or create a group on the Group tab to save shared havens. You can still practice a disaster.</Text>}
    {HAZARD_TYPES.map(h => <View key={h} style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Prepare ${HAZARDS[h].label} haven`} style={styles.main}
        onPress={() => router.push({ pathname: '/disaster-haven', params: { hazard: h, groupId: group?.id ?? '' } })}>
        <Ionicons name={HAZARDS[h].icon} size={26} color={colors.dangerText} />
        <View style={{ flex: 1 }}><Text style={styles.label}>{HAZARDS[h].label}</Text><Text style={styles.small}>{savedHaven(group, h)?.name ?? 'No haven saved'}</Text></View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
    </View>)}
    <Text style={styles.label}>Practice a disaster</Text>
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
      {HAZARD_TYPES.map(h => <Pressable key={h} accessibilityRole="button" accessibilityState={{ selected: hazard === h }} onPress={() => setHazard(h)} style={[styles.choice, { backgroundColor: hazard === h ? colors.primary : colors.card }]}>
        <Text style={{ color: hazard === h ? colors.onPrimary : colors.text }}>{HAZARDS[h].label}</Text>
      </Pressable>)}
    </ScrollView>
    <BigButton label="Simulate disaster" variant="alarm" icon="warning-outline" onPress={simulate} />
    <Text style={styles.small}>{group ? `This sends a practice alert to ${group.name}. It does not change their meeting point.` : 'This is a practice alert on your phone.'}</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, hint: { color: colors.muted, fontSize: 17, lineHeight: 24 },
  row: { backgroundColor: colors.card, borderRadius: radius }, main: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 80, padding: 16 },
  label: { color: colors.text, fontSize: 17, fontWeight: '600' }, small: { color: colors.muted, fontSize: 14, lineHeight: 20 }, choice: { padding: 14, borderRadius: radius },
});
