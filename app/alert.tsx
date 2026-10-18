// [OWNER: ALERTS] Shown when an alert affects the user: what to do now, then one tap to route to safety.
// Design: urgency ladder — watch (amber band) · warning (red header) · emergency (full red takeover).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { distanceM, formatAge, formatDistance, nearestPlace } from '@/lib/geo';
import { buzzFor } from '@/lib/haptics';
import { HAZARDS, meetingPlaceOk, OFFICIAL_NOTE, OUTSIDE_STEPS, pickSafeTarget } from '@/lib/hazards';
import { requestMapFocus } from '@/lib/mapFocus';
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

  // Route there and take the user straight to the Map (not back to whichever tab opened the alert).
  // Don't wait for the walking route: routeTo draws a line right away and upgrades it when it arrives.
  const go = (place: Place) => {
    stopBuzz.current();
    void actions.routeTo(place);
    requestMapFocus({ place, label: place.name, showMe: true });
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
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
        <Text style={styles.calmTitle}>No active alerts</Text>
        <BigButton label="Back to map" icon="map-outline" onPress={() => router.back()} />
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
  const dist = (p: Place) => (me ? ` (${formatDistance(distanceM(me, p.coord))})` : '');

  const emergency = level === 'emergency';
  const onRed = emergency || level === 'warning';
  const fg = emergency ? colors.onDanger : colors.text;
  const soft = emergency ? colors.onDanger : colors.muted;
  const when = formatAge(Math.max(0, Date.now() - a.issuedAt));
  const source = a.source === 'nws' ? 'National Weather Service' : a.source === 'usgs' ? 'USGS' : 'Simulated';

  // Secondary buttons: a soft tint of the foreground on red, the tonal surface elsewhere.
  const tonal = emergency ? 'rgba(255,244,239,0.18)' : colors.card;
  const onHeader = onRed ? colors.onDanger : colors.onWarn;
  const levelName = emergency ? 'Emergency' : level === 'warning' ? 'Warning' : 'Watch';

  return (
    <View style={[styles.screen, { backgroundColor: emergency ? colors.danger : colors.bg }]}>
      {/* Status bar sits on the header color: light over red, dark over amber, in either appearance. */}
      <StatusBar style={onRed ? 'light' : 'dark'} />
      {/* Header: amber band (watch), red block (warning), or part of the full-red page (emergency). */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 20 },
          level === 'watch' && { backgroundColor: colors.warn },
          level === 'warning' && { backgroundColor: colors.danger },
        ]}
      >
        <Text accessibilityRole="header" style={[emergency ? styles.headlineXL : styles.headline, { color: onHeader }]}>
          {headline(a)}
        </Text>
        <View style={styles.metaRow}>
          {info && <Ionicons name={info.icon} size={20} color={onHeader} />}
          <Text style={[styles.meta, { color: onHeader }]}>
            {a.source === 'simulated' ? 'Drill: ' : ''}{info ? `${info.label}, ` : ''}{levelName.toLowerCase()}, {when}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
        <Text style={[styles.desc, { color: fg }]}>{a.description}</Text>

        <View style={styles.areaRow}>
          <Ionicons
            name={affected ? 'alert-circle' : 'checkmark-circle'}
            size={22}
            color={affected ? (emergency ? colors.onDanger : colors.dangerText) : colors.safe}
          />
          <Text style={[styles.area, { color: affected ? (emergency ? colors.onDanger : colors.dangerText) : colors.safe }]}>
            {affected ? 'You are in the affected area' : 'You are outside the affected area'}
          </Text>
        </View>

        <Text style={[styles.section, { color: fg }]}>{affected ? 'What to do now' : 'Stay ready'}</Text>
        {steps.map((s, i) => (
          <View key={i} style={styles.step}>
            <Text style={[styles.stepNum, { color: fg }]}>{i + 1}.</Text>
            <Text style={[styles.stepText, { color: fg }]}>{s}</Text>
          </View>
        ))}

        {affected && info && <Text style={[styles.moveNote, { color: fg }]}>{info.moveNote}</Text>}
        <Text style={[styles.fine, { color: soft }]}>{OFFICIAL_NOTE} Source: {source}.</Text>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
        {affected && best && (
          <AlertButton
            label={`Go to ${best.name}${dist(best)}`}
            icon="navigate"
            bg={emergency ? colors.onDanger : colors.primary}
            fg={emergency ? colors.danger : colors.onPrimary}
            tall
            onPress={() => go(best)}
          />
        )}
        {meeting && meeting.id !== best?.id && (
          <AlertButton
            label={`Go to meeting point: ${meeting.name}${dist(meeting)}`}
            icon="flag"
            bg={affected && best ? tonal : emergency ? colors.onDanger : colors.primary}
            fg={affected && best ? fg : emergency ? colors.danger : colors.onPrimary}
            tall={!(affected && best)}
            onPress={() => go(meeting)}
          />
        )}
        <AlertButton
          label={state.myStatus === 'safe' ? 'Marked as safe' : 'I’m safe'}
          icon={state.myStatus === 'safe' ? 'checkmark-circle' : 'checkmark-circle-outline'}
          bg={tonal}
          fg={fg}
          onPress={safe}
        />
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

function AlertButton(p: { label: string; icon: ComponentProps<typeof Ionicons>['name']; bg: ColorValue; fg: ColorValue; tall?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={({ pressed }) => [styles.btn, p.tall && styles.btnTall, { backgroundColor: p.bg, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={p.icon} size={22} color={p.fg} />
      <Text style={[styles.btnText, { color: p.fg }]} numberOfLines={2}>{p.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 18, gap: 8 },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  headlineXL: { fontSize: 44, lineHeight: 50, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 12 },
  desc: { fontSize: 17, lineHeight: 24 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  area: { flex: 1, fontSize: 17, fontWeight: '600' },
  section: { marginTop: 8, fontSize: 20, lineHeight: 25, fontWeight: '600' },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 24, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  stepText: { flex: 1, fontSize: 17, lineHeight: 24 },
  moveNote: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  fine: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  actions: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  btn: { minHeight: minTarget, borderRadius: radius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  btnTall: { minHeight: 64 },
  btnText: { fontSize: 17, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  dismiss: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  calm: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 20 },
  calmTitle: { fontSize: 28, fontWeight: '700', color: colors.text },
});
