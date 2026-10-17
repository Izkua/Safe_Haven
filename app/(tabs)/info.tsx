// [OWNER: UI · STRETCH] Offline first-aid cards. Content must be bundled in the app (no network).
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 12, padding: 16 }}>
      {CARDS.map((c) => (
        <View key={c.title} style={styles.card}>
          <Text style={styles.title}>{c.title}</Text>
          {c.steps.map((s, i) => (
            <Text key={i} style={styles.step}>{i + 1}. {s}</Text>
          ))}
        </View>
      ))}
      {/* Dev builds only: re-run onboarding without reinstalling Expo Go. */}
      {__DEV__ && <BigButton label="Reset onboarding (dev)" variant="secondary" onPress={resetOnboarding} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 6 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  step: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
