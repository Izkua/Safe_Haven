// [OWNER: UI · STRETCH] First aid + disaster guides as tappable topics. The gear opens Settings.
// Everything here is bundled in the app, so it works with no signal.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { tap } from '@/lib/haptics';
import { HAZARD_TYPES, HAZARDS } from '@/lib/hazards';
import { colors, radius } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Topic = { id: string; title: string; icon: IconName; steps: string[] };

// TODO [UI]: move to src/content/firstAid.json and add bleeding / burns once the text is reviewed.
const FIRST_AID: Topic[] = [
  { id: 'cpr', title: 'CPR (adult)', icon: 'heart-outline', steps: ['Call 911.', 'Push hard and fast in the center of the chest: 100–120/min, 2 in deep.', 'Keep going until help arrives or an AED is ready.'] },
  { id: 'choking', title: 'Choking (Heimlich)', icon: 'hand-left-outline', steps: ['Stand behind them, fist above the navel.', 'Quick upward thrusts until the object comes out.', 'If they become unresponsive, start CPR.'] },
];

// The same step-by-step guidance the alert screen shows, readable any time.
const DISASTERS: Topic[] = HAZARD_TYPES.map((h) => ({ id: h, title: HAZARDS[h].label, icon: HAZARDS[h].icon, steps: HAZARDS[h].steps }));

export default function InfoScreen() {
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (id: string) => {
    tap();
    setOpen((cur) => (cur === id ? null : id));
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, styles.flex]} accessibilityRole="header">First aid</Text>
          <Pressable
            onPress={() => { tap(); router.push('/settings'); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={({ pressed }) => [styles.gear, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.lead}>Works without signal. Tap a topic to see the steps.</Text>

        <BigButton
          label="Call 911"
          icon="call"
          variant="danger"
          style={styles.call}
          accessibilityHint="Opens your phone app to call 911"
          onPress={() => void Linking.openURL('tel:911')}
        />

        <Text style={styles.heading} accessibilityRole="header">Someone is hurt</Text>
        <View style={styles.list}>
          {FIRST_AID.map((t) => <TopicButton key={t.id} topic={t} open={open === t.id} onPress={() => toggle(t.id)} />)}
        </View>

        <Text style={styles.heading} accessibilityRole="header">During a disaster</Text>
        <View style={styles.list}>
          {DISASTERS.map((t) => <TopicButton key={t.id} topic={t} open={open === t.id} onPress={() => toggle(t.id)} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A topic is a real button; its steps open underneath, inside the same surface.
 * The header's layout is identical open or closed (same border width, both text lines always
 * rendered): unmounting a sibling line made the title collapse on Android's new renderer.
 */
function TopicButton({ topic, open, onPress }: { topic: Topic; open: boolean; onPress: () => void }) {
  return (
    <View style={[styles.topic, { borderColor: open ? colors.text : 'transparent' }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Hides the steps' : 'Shows the steps'}
        onPress={onPress}
        style={({ pressed }) => [styles.topicHead, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name={topic.icon} size={26} color={colors.text} />
        <View style={styles.topicText}>
          <Text style={styles.topicTitle} numberOfLines={2}>{topic.title}</Text>
          <Text style={styles.topicMeta} numberOfLines={1}>{open ? 'Tap to close' : `${topic.steps.length} steps`}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />
      </Pressable>
      {open && (
        <View style={styles.steps}>
          {topic.steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNum}>{i + 1}.</Text>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  gear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.text },
  lead: { marginTop: 4, fontSize: 17, lineHeight: 24, color: colors.muted },
  call: { marginTop: 20, minHeight: 64 },
  heading: { marginTop: 28, marginBottom: 10, fontSize: 20, lineHeight: 25, fontWeight: '600', color: colors.text },
  list: { gap: 10 },
  topic: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 2, overflow: 'hidden' },
  topicHead: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 14, paddingVertical: 8 },
  topicText: { flex: 1, minHeight: 42, justifyContent: 'center' },
  topicTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: colors.text },
  topicMeta: { fontSize: 15, lineHeight: 20, color: colors.muted },
  steps: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 26, fontSize: 18, lineHeight: 26, fontWeight: '700', color: colors.text },
  stepText: { flex: 1, fontSize: 18, lineHeight: 26, color: colors.text },
});
