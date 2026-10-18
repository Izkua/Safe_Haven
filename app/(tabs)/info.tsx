// [OWNER: UI · STRETCH] Offline first-aid cards. Content must be bundled in the app (no network).
// Design: ruled sections, numbered steps, body ≥ 18.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { useOnboarding } from '@/components/OnboardingGate';
import { colors } from '@/theme';

// TODO [UI]: move to src/content/firstAid.json, add CPR / Heimlich / bleeding / burns, with step images.
const CARDS = [
  { title: 'CPR (adult)', steps: ['Call 911.', 'Push hard and fast in the center of the chest: 100–120/min, 2 in deep.', 'Keep going until help arrives or an AED is ready.'] },
  { title: 'Choking (Heimlich)', steps: ['Stand behind them, fist above the navel.', 'Quick upward thrusts until the object comes out.', 'If they become unresponsive, start CPR.'] },
];

export default function InfoScreen() {
  const { resetOnboarding } = useOnboarding();
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.label}>Works without signal</Text>
        <Text style={styles.h1} accessibilityRole="header">First aid</Text>
        <Text style={styles.note}>Not a substitute for 911. Call first if you can.</Text>

        {CARDS.map((c) => (
          <View key={c.title} style={styles.section}>
            <Text style={styles.title} accessibilityRole="header">{c.title}</Text>
            {c.steps.map((s, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Dev builds only: re-run onboarding without reinstalling Expo Go. */}
        {__DEV__ && (
          <View style={{ marginTop: 40 }}>
            <BigButton label="Reset onboarding (dev)" variant="secondary" onPress={resetOnboarding} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  label: { fontSize: 16, fontWeight: '600', color: colors.muted },
  h1: { marginTop: 6, fontSize: 40, lineHeight: 42, fontWeight: '700', color: colors.text },
  note: { marginTop: 10, fontSize: 16, fontWeight: '600', color: colors.text },
  section: { marginTop: 28, borderTopWidth: 1, borderColor: colors.text, paddingTop: 14, gap: 12 },
  title: { fontSize: 24, lineHeight: 27, fontWeight: '700', color: colors.text },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepNum: { width: 28, fontSize: 24, lineHeight: 26, fontWeight: '700', color: colors.text },
  stepText: { flex: 1, fontSize: 18, lineHeight: 26, color: colors.text },
});
