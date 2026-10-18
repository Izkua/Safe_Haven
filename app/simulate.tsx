// [OWNER: ALERTS] Pick a disaster to simulate at your current location (demo / drills).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { HAZARD_TYPES, HAZARDS } from '@/lib/hazards';
import { useApp } from '@/state/AppContext';
import { colors, radius } from '@/theme';
import type { HazardType } from '@/types';

export default function SimulateScreen() {
  const { state, actions } = useApp();
  const simulate = (hazard: HazardType) => {
    router.back(); // the map screen opens /alert as soon as the new alert is set
    void actions.startDrill(hazard); // also sent to everyone in your group
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.hint}>{state.group ? `Pick a disaster to practice. Everyone in ${state.group.name} gets the drill alert too, marked as practice.` : 'Pick a disaster to practice. You’ll see the same steps as a real alert, marked as a drill.'}</Text>
      {HAZARD_TYPES.map((h) => (
        <Pressable key={h} accessibilityRole="button" accessibilityLabel={`Practice ${HAZARDS[h].label}`} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} onPress={() => simulate(h)}>
          <Ionicons name={HAZARDS[h].icon} size={26} color={colors.dangerText} />
          <Text style={styles.label}>{HAZARDS[h].label}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hint: { color: colors.muted, fontSize: 17, lineHeight: 24, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, backgroundColor: colors.card, borderRadius: radius, paddingHorizontal: 16, marginBottom: 10 },
  label: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600' },
});
