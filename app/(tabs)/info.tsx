// [OWNER: UI · STRETCH] Offline first-aid steps + app settings. Content is bundled (works with no signal).
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { useOnboarding } from '@/components/OnboardingGate';
import { loadAppearancePref, setAppearancePref, type AppearancePref } from '@/lib/appearance';
import { tap } from '@/lib/haptics';
import { colors, radius } from '@/theme';

// TODO [UI]: move to src/content/firstAid.json, add CPR / Heimlich / bleeding / burns, with step images.
const CARDS = [
  { title: 'CPR (adult)', steps: ['Call 911.', 'Push hard and fast in the center of the chest: 100–120/min, 2 in deep.', 'Keep going until help arrives or an AED is ready.'] },
  { title: 'Choking (Heimlich)', steps: ['Stand behind them, fist above the navel.', 'Quick upward thrusts until the object comes out.', 'If they become unresponsive, start CPR.'] },
];

const APPEARANCE: { value: AppearancePref; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match phone' },
];

export default function InfoScreen() {
  const { resetOnboarding } = useOnboarding();
  const [pref, setPref] = useState<AppearancePref | null>(null);

  useEffect(() => {
    loadAppearancePref().then(setPref);
  }, []);

  const choose = (p: AppearancePref) => {
    tap();
    setPref(p);
    void setAppearancePref(p);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.title} accessibilityRole="header">First aid</Text>
        <Text style={styles.lead}>Works without signal. Call 911 first if you can.</Text>

        {CARDS.map((c) => (
          <View key={c.title} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">{c.title}</Text>
            {c.steps.map((s, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepNum}>{i + 1}.</Text>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">Appearance</Text>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {APPEARANCE.map((o) => {
              const on = pref === o.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => choose(o.value)}
                  style={({ pressed }) => [styles.segBtn, on && styles.segOn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Dev builds only: re-run onboarding without reinstalling Expo Go. */}
        {__DEV__ && (
          <View style={{ marginTop: 32 }}>
            <BigButton label="Reset onboarding (dev)" variant="plain" onPress={resetOnboarding} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.text },
  lead: { marginTop: 4, fontSize: 17, lineHeight: 24, color: colors.muted },
  section: { marginTop: 28, gap: 10 },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '600', color: colors.text },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 24, fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.text },
  stepText: { flex: 1, fontSize: 17, lineHeight: 24, color: colors.text },
  segment: { flexDirection: 'row', gap: 6, backgroundColor: colors.card, borderRadius: radius, padding: 4 },
  segBtn: { flex: 1, minHeight: 48, borderRadius: radius - 4, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.primary },
  segText: { fontSize: 15, fontWeight: '600', color: colors.text },
  segTextOn: { color: colors.onPrimary },
});
