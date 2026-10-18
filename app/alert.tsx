// [OWNER: ALERTS] Shown when an alert affects the user: what to do now, then one tap to route to safety.
// Design: urgency ladder — watch (amber band) · warning (red header) · emergency (full red takeover).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { distanceM, formatAge, formatDistance, nearestPlace } from '@/lib/geo';
import { buzzFor } from '@/lib/haptics';
import { HAZARDS, meetingPlaceOk, OFFICIAL_NOTE, OUTSIDE_STEPS, pickSafeTarget } from '@/lib/hazards';
import { isUserAffected } from '@/services/alerts';
import { useApp } from '@/state/AppContext';
import { colors, minTarget, radius, urgencyFor } from '@/theme';
import type { HazardAlert, Place } from '@/types';

const isQuake = (a: HazardAlert) => a.hazard === 'earthquake' || a.source === 'usgs' || /earthquake/i.test(a.title);

/** Big imperative headline: the one thing to do right now. */
function headline(a: HazardAlert): string {
  if (isQuake(a) && a.severity !== 'minor' && a.severity !== 'moderate') return 'Drop.\nCover.\nHold on.';
  return a.title.replace(/\s*\(SIMULATED\)\s*/i, '');
}

export default function AlertScreen() {
  const { state, actions } = useApp();
  const insets = useSafeAreaInsets();
  const a = state.activeAlert;
  const me = state.myLocation;
  // Unknown location: assume affected, so the user still sees the safety steps.
  const affected = a ? (me ? isUserAffected(a, me) : true) : false;
  // Outside the area the tone drops to "watch": stay ready, no takeover.
  const level = a && affected ? urgencyFor(a.severity) : 'watch';
  const stopBuzz = useRef<() => void>(() => {});

  // Vibrate per urgency; emergency repeats until the user acts or leaves the screen.
  useEffect(() => {
    if (!a) return;
    stopBuzz.current = buzzFor(level);
    return () => stopBuzz.current();
  }, [a?.id, level]);

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

  const info = a.hazard ? HAZARDS[a.hazard] : null;
  const steps = affected ? info?.steps ?? (a.instruction ? [a.instruction] : []) : OUTSIDE_STEPS;

  const group = state.group;
  const best: Place | null = me
    ? a.hazard ? pickSafeTarget(a.hazard, me, group) : group ? nearestPlace(me, group.safeAreas) : null
    : null;
  const myMeeting = group ? group.meetingPlace : state.personalMeetingPlace;
  const meeting = myMeeting && (!a.hazard || meetingPlaceOk(a.hazard)) ? myMeeting : null;
  const dist = (p: Place) => (me ? ` · ${formatDistance(distanceM(me, p.coord))}` : '');

  const emergency = level === 'emergency';
  const onRed = emergency || level === 'warning';
  const fg = emergency ? colors.onDanger : colors.text;
  const soft = emergency ? colors.onDanger : colors.muted;
  const when = formatAge(Math.max(0, Date.now() - a.issuedAt));
  const source = a.source === 'nws' ? 'National Weather Service' : a.source === 'usgs' ? 'USGS' : 'Simulated';

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
        <View style={styles.kickerRow}>
          {info && <Ionicons name={info.icon} size={22} color={onRed ? colors.onDanger : colors.text} />}
          <Text style={[styles.kicker, { color: onRed ? colors.onDanger : colors.text }]}>
            {emergency ? 'Emergency' : level === 'warning' ? 'Warning' : 'Watch'}
            {info ? ` · ${info.label}` : ''} · {when}
          </Text>
        </View>
        <Text accessibilityRole="header" style={[emergency ? styles.headlineXL : styles.headline, { color: onRed ? colors.onDanger : colors.text }]}>
          {headline(a)}
        </Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
        <Text style={[styles.desc, { color: fg }]}>{a.description}</Text>

        <Text style={[styles.area, { color: affected ? (emergency ? colors.onDanger : colors.danger) : colors.safe }]}>
          {affected ? 'You are in the affected area' : 'You are outside the affected area'}
        </Text>

        <View style={[styles.stepsBlock, { borderColor: fg }]}>
          <Text style={[styles.section, { color: fg }]}>{affected ? 'What to do now' : 'Stay ready'}</Text>
          {steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <Text style={[styles.stepNum, { color: fg }]}>{i + 1}</Text>
              <Text style={[styles.stepText, { color: fg }]}>{s}</Text>
            </View>
          ))}
        </View>

        {affected && info && <Text style={[styles.moveNote, { color: fg }]}>{info.moveNote}</Text>}
        <Text style={[styles.fine, { color: soft }]}>{OFFICIAL_NOTE}</Text>
        <Text style={[styles.fine, { color: soft }]}>Source: {source}</Text>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        {affected && best && (
          <Pressable
            accessibilityRole="button"
            onPress={() => go(best)}
            style={({ pressed }) => [styles.btn, styles.btnTall, emergency ? styles.btnWhite : styles.btnInk, pressed && styles.pressed]}
          >
            <Text style={[styles.btnText, styles.btnTextBig, { color: emergency ? colors.danger : colors.onPrimary }]}>
              Safest nearby · {best.name}{dist(best)}
            </Text>
          </Pressable>
        )}
        {meeting && meeting.id !== best?.id && (
          <Pressable
            accessibilityRole="button"
            onPress={() => go(meeting)}
            style={({ pressed }) => [
              styles.btn,
              affected && best ? [styles.btnOutline, { borderColor: fg }] : [styles.btnTall, emergency ? styles.btnWhite : styles.btnInk],
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.btnText, { color: affected && best ? fg : emergency ? colors.danger : colors.onPrimary }]}>
              Go to meeting place · {meeting.name}{dist(meeting)}
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={safe}
          style={({ pressed }) => [styles.btn, styles.btnOutline, { borderColor: fg }, state.myStatus === 'safe' && { backgroundColor: emergency ? 'rgba(255,255,255,0.18)' : colors.card }, pressed && styles.pressed]}
        >
          <Text style={[styles.btnText, { color: fg }]}>{state.myStatus === 'safe' ? 'Marked safe ✓' : "I'm safe"}</Text>
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
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  headline: { fontSize: 32, lineHeight: 35, fontWeight: '700' },
  headlineXL: { fontSize: 60, lineHeight: 63, fontWeight: '700' },
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, gap: 14 },
  desc: { fontSize: 19, lineHeight: 27, fontWeight: '500' },
  area: { fontSize: 17, fontWeight: '700' },
  stepsBlock: { borderTopWidth: 1, paddingTop: 12, gap: 12 },
  section: { fontSize: 22, fontWeight: '700' },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepNum: { width: 26, fontSize: 22, lineHeight: 26, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 18, lineHeight: 26 },
  moveNote: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  fine: { fontSize: 14, fontWeight: '600' },
  actions: { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
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
