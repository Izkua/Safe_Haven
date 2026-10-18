// [OWNER: ALERTS] Pick a disaster to simulate at your current location (demo / drills).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { HAZARD_TYPES, HAZARDS } from '@/lib/hazards';
import { UW_CENTER } from '@/mocks/demo';
import { makeSimulatedAlert } from '@/services/alerts';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';
import type { HazardType } from '@/types';

export default function SimulateScreen() {
  const { state, actions } = useApp();
  const center = state.myLocation ?? state.group?.meetingPlace?.coord ?? UW_CENTER;

  const simulate = (hazard: HazardType) => {
    router.back(); // the map screen opens /alert as soon as the new alert is set
    void actions.triggerAlert(makeSimulatedAlert(center, hazard));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 24 }}>
      <Text style={styles.hint}>Simulates a warning centered on your location so you can practice what to do.</Text>
      {HAZARD_TYPES.map((h) => (
        <Pressable key={h} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} onPress={() => simulate(h)}>
          <Ionicons name={HAZARDS[h].icon} size={26} color={colors.danger} />
          <Text style={styles.label}>{HAZARDS[h].label}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hint: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, borderTopWidth: 1, borderColor: colors.text, paddingHorizontal: 4 },
  label: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '700' },
});
