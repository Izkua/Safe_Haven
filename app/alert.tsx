// [OWNER: ALERTS] Shown when an alert affects the user. One tap → route to safety.
// Design: urgency ladder — watch (amber band) · warning (red header) · emergency (full red takeover).
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { distanceM, formatAge, formatDistance, nearestPlace } from '@/lib/geo';
import { buzzFor } from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import { colors, minTarget, radius, urgencyFor } from '@/theme';
import type { HazardAlert, Place } from '@/types';

const isQuake = (a: HazardAlert) => a.source === 'usgs' || /earthquake/i.test(a.title);

/** Big imperative headline: the one thing to do right now. */
function headline(a: HazardAlert): string {
  if (isQuake(a) && a.severity !== 'minor' && a.severity !== 'moderate') return 'Drop.\nCover.\nHold on.';
  return a.title.replace(/\s*\(SIMULATED\)\s*/i, '');
}

export default function AlertScreen() {
  const { state, actions } = useApp();
  const insets = useSafeAreaInsets();
  const a = state.activeAlert;
  const level = a ? urgencyFor(a.severity) : 'watch';
  const stopBuzz = useRef<() => void>(() => {});

  // Vibrate per urgency; emergency repeats until the user acts or leaves the screen.
  useEffect(() => {
    if (!a) return;
    stopBuzz.current = buzzFor(level);
    return () => stopBuzz.current();
  }, [a?.id, level]);

  const me = state.myLocation;
  const meeting = state.group?.meetingPlace ?? null;
  const nearest = me && state.group ? nearestPlace(me, state.group.safeAreas) : null;
  const dist = (p: Place) => (me ? ` · ${formatDistance(distanceM(me, p.coord))}` : '');

  const go = async (place: Place) => {
    stopBuzz.current();
    await actions.routeTo(place);
    router.back();
  };
  const safe = () => {
    stopBuzz.current();
    actions.setStatus('safe');
  };
  const dismiss = () => {
    stopBuzz.current();
    actions.dismissAlert();
    router.back();
  };

  if (!a) {
    return (
      <View style={[styles.calm, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.calmTitle}>No active alerts.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.btn, styles.btnInk]}>
          <Text style={[styles.btnText, { color: colors.onPrimary }]}>Back to map</Text>
        </Pressable>
      </View>
    );
  }

  const emergency = level === 'emergency';
  const fg = emergency ? colors.onDanger : colors.text;
  const when = formatAge(Math.max(0, Date.now() - a.issuedAt));
  const source = a.source === 'nws' ? 'National Weather Service' : a.source === 'usgs' ? 'USGS' : 'Simulated';
  const primary = meeting ?? nearest;
  const secondary = meeting && nearest ? nearest : null;

  return (
    <View style={[styles.screen, { backgroundColor: emergency ? colors.danger : colors.bg }]}>
      {/* Header: amber band (watch), red block (warning), or part of the full-red page (emergency). */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 20 },
          level === 'watch' && { backgroundColor: colors.warn },
          level === 'warning' && { backgroundColor: colors.danger },
        ]}
      >
        <Text style={[styles.kicker, { color: level === 'warning' || emergency ? colors.onDanger : colors.text }]}>
          {emergency ? 'Emergency' : level === 'warning' ? 'Warning' : 'Watch'} · {when}
        </Text>
        <Text
          accessibilityRole="header"
          style={[emergency ? styles.headlineXL : styles.headline, { color: level === 'warning' || emergency ? colors.onDanger : colors.text }]}
        >
          {headline(a)}
        </Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
        <Text style={[styles.desc, { color: fg }]}>{a.description}</Text>
        {a.instruction && <Text style={[styles.instruction, { color: fg }]}>{a.instruction}</Text>}
        <Text style={[styles.source, { color: emergency ? colors.onDanger : colors.muted }]}>Source: {source}</Text>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        {isQuake(a) && emergency && <Text style={[styles.when, { color: fg }]}>When the shaking stops</Text>}
        {primary && (
          <Pressable
            accessibilityRole="button"
            onPress={() => go(primary)}
            style={({ pressed }) => [styles.btn, styles.btnTall, emergency ? styles.btnWhite : styles.btnInk, pressed && styles.pressed]}
          >
            <Text style={[styles.btnText, styles.btnTextBig, { color: emergency ? colors.danger : colors.onPrimary }]}>
              {primary === meeting ? 'Go to meeting place' : `Go to ${primary.name}`}
              {dist(primary)}
            </Text>
          </Pressable>
        )}
        {secondary && (
          <Pressable
            accessibilityRole="button"
            onPress={() => go(secondary)}
            style={({ pressed }) => [styles.btn, styles.btnOutline, { borderColor: fg }, pressed && styles.pressed]}
          >
            <Text style={[styles.btnText, { color: fg }]}>Nearest safe area · {secondary.name}{dist(secondary)}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={safe}
          style={({ pressed }) => [styles.btn, styles.btnOutline, { borderColor: fg }, state.myStatus === 'safe' && { backgroundColor: emergency ? 'rgba(255,255,255,0.18)' : colors.card }, pressed && styles.pressed]}
        >
          <Text style={[styles.btnText, { color: fg }]}>{state.myStatus === 'safe' ? "Marked safe ✓" : "I'm safe"}</Text>
        </Pressable>
        {emergency ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Press and hold to dismiss this emergency alert"
            onLongPress={dismiss}
            delayLongPress={800}
            style={styles.dismiss}
          >
            <Text style={[styles.dismissText, { color: fg }]}>Press and hold to dismiss</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.dismiss}>
            <Text style={[styles.dismissText, { color: fg }]}>Dismiss</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 20, gap: 12 },
  kicker: { fontSize: 18, fontWeight: '700' },
  headline: { fontSize: 32, lineHeight: 35, fontWeight: '700' },
  headlineXL: { fontSize: 60, lineHeight: 63, fontWeight: '700' },
  body: { paddingHorizontal: 24, paddingTop: 8, gap: 14 },
  desc: { fontSize: 20, lineHeight: 28, fontWeight: '500' },
  instruction: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  source: { fontSize: 15, fontWeight: '600' },
  actions: { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
  when: { fontSize: 17, fontWeight: '700' },
  btn: { minHeight: minTarget, borderRadius: radius, justifyContent: 'center', paddingHorizontal: 18 },
  btnTall: { minHeight: 72 },
  btnInk: { backgroundColor: colors.primary },
  btnWhite: { backgroundColor: colors.onDanger },
  btnOutline: { borderWidth: 2, backgroundColor: 'transparent' },
  btnText: { fontSize: 19, fontWeight: '700' },
  btnTextBig: { fontSize: 21 },
  pressed: { opacity: 0.75 },
  dismiss: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  calm: { flex: 1, backgroundColor: colors.bg, padding: 24, gap: 24 },
  calmTitle: { fontSize: 32, fontWeight: '700', color: colors.text },
});
