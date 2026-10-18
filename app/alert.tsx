// [OWNER: ALERTS] Shown when an alert affects the user: what to do now, then one tap to route to safety.
// Design: urgency ladder — watch (amber band) · warning (red header) · emergency (full red takeover).
// Body: a "Right now" card with the 2 most urgent actions, then short icon cards (bullets, not steps:
// the advice isn't in a fixed order). Full step-by-step guidance stays on the First aid tab.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { distanceM, formatAge, formatDistance, nearestPlace } from '@/lib/geo';
import { buzzFor } from '@/lib/haptics';
import { HAZARDS, meetingPlaceOk, OFFICIAL_NOTE, OUTSIDE_NOW, pickSafeTarget } from '@/lib/hazards';
import { savedHaven, usualMeetingPoint } from '@/lib/havens';
import { requestMapFocus } from '@/lib/mapFocus';
import { isUserAffected } from '@/services/alerts';
import { useApp } from '@/state/AppContext';
import { colors, minTarget, radius, urgencyFor } from '@/theme';
import type { HazardAlert, Place } from '@/types';

/** Headline: the alert's own title (e.g. "Earthquake Warning"), the same pattern for every hazard. */
function headline(a: HazardAlert): string {
  return a.title.replace(/\s*\(SIMULATED\)\s*/i, '');
}

/** Text on the cream "Right now" card (cream in both appearances, so always dark text). */
const INK = '#2A2118';

export default function AlertScreen() {
  const { state, actions } = useApp();
  const insets = useSafeAreaInsets();
  const a = state.activeAlert;
  const me = state.myLocation;
  const [adopting, setAdopting] = useState(false);
  const [ending, setEnding] = useState(false);
  const endingRef = useRef(false);
  const [destination, setDestination] = useState<'haven' | 'usual'>('haven');
  useEffect(() => { setDestination('haven'); }, [a?.id]);
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
  const dismiss = async () => {
    if (endingRef.current || adopting) return;
    endingRef.current = true;
    setEnding(true);
    stopBuzz.current();
    try {
      if (await actions.dismissAlert()) {
        const drillGroup = a?.groupId ? state.groups.find(g => g.id === a.groupId) : null;
        const normal = drillGroup ? usualMeetingPoint(drillGroup) : null;
        if (a?.source === 'simulated' && normal && drillGroup?.id === state.activeGroupId) requestMapFocus({ place: normal, label: normal.name, showMe: true });
        if (router.canDismiss()) router.dismissAll();
        router.navigate('/');
      }
    } finally { endingRef.current = false; setEnding(false); }
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
  // Inside the area: the hazard's 2 most urgent actions, then its icon cards. Outside: stay-ready bullets only.
  const nowList = affected ? info?.now ?? [a.instruction ?? a.description] : OUTSIDE_NOW;
  const cards = affected ? info?.cards ?? [] : [];

  const group = a.groupId ? state.groups.find(g => g.id === a.groupId) ?? null : state.group;
  const suggestion = a.source === 'simulated' && a.groupId && a.hazard ? savedHaven(group, a.hazard) : null;
  const usual = group ? usualMeetingPoint(group) : null;
  const best: Place | null = me
    ? a.hazard ? pickSafeTarget(a.hazard, me, group) : group ? nearestPlace(me, group.safeAreas) : null
    : null;
  const myMeeting = group ? group.meetingPlace : state.personalMeetingPlace;
  const meeting = myMeeting && (!a.hazard || meetingPlaceOk(a.hazard)) ? myMeeting : null;
  const primary: Place | null = affected && best ? best : meeting;
  const dist = (p: Place) => (me ? ` · ${formatDistance(distanceM(me, p.coord))}` : '');

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
            {a.source === 'simulated'
              ? `Drill: ${info ? info.simShort : 'practice alert'}`
              : `${info ? `${info.label}, ` : ''}${levelName.toLowerCase()}, ${when}`}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
        {suggestion && group && <View style={[styles.destinationCard, { backgroundColor: tonal }]}>
          <Text style={[styles.labelText, { color: fg }]}>Meeting point · {group.name}</Text>
          <View style={styles.btnRow}>
            {(['usual', 'haven'] as const).map(choice => {
              const place = choice === 'usual' ? usual : suggestion;
              const selected = destination === choice;
              return <Pressable key={choice} accessibilityRole="button" accessibilityState={{ selected, disabled: !place || adopting || ending }}
                disabled={!place || adopting || ending} onPress={() => setDestination(choice)}
                style={[styles.destinationChoice, { borderColor: selected ? fg : 'transparent', opacity: place ? 1 : 0.5 }]}>
                <Text style={[styles.labelText, { color: fg }]}>{choice === 'usual' ? 'Usual point' : `${info?.label ?? 'Disaster'} haven`}</Text>
                <Text style={{ color: soft }} numberOfLines={2}>{place?.name ?? 'Not set'}</Text>
              </Pressable>;
            })}
          </View>
          <Text style={{ color: soft, fontSize: 13 }}>Go updates the group’s meeting point. Ending this drill restores the usual point.</Text>
        </View>}
        {/* The most urgent actions, in a card that stands out from everything else. */}
        <View style={[styles.nowCard, { backgroundColor: emergency ? colors.onDanger : colors.card }]}>
          <Text style={[styles.nowLabel, { color: emergency ? colors.danger : affected ? colors.dangerText : colors.safe }]}>
            {affected ? 'Right now' : 'You’re outside the affected area'}
          </Text>
          {nowList.map((t, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color: emergency ? INK : colors.text }]}>{'\u2022'}</Text>
              <Text style={[styles.nowText, { color: emergency ? INK : colors.text }]}>{t}</Text>
            </View>
          ))}
        </View>

        {cards.map((c, i) => (
          <View key={i} style={[styles.card, { backgroundColor: tonal }]}>
            <View style={[styles.cardIcon, { backgroundColor: emergency ? colors.onDanger : colors.danger }]}>
              <Ionicons name={c.icon} size={18} color={emergency ? colors.danger : colors.onDanger} />
            </View>
            <Text style={[styles.cardText, { color: fg }]}>{c.text}</Text>
          </View>
        ))}

        <Text style={[styles.fine, { color: soft }]}>{OFFICIAL_NOTE} Source: {source}.</Text>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
        {suggestion && group && a.hazard && <>
          <BigButton label={destination === 'haven' ? 'Go to suggested meeting point' : 'Go to usual meeting point'} icon="flag" loading={adopting} disabled={!state.isOnline || ending || (destination === 'usual' && !usual)}
            accessibilityHint="Updates the meeting point for this whole group, then opens the map"
            onPress={() => {
              setAdopting(true);
              const request = destination === 'haven' ? actions.adoptDisasterHaven(group.id, a.hazard!) : actions.restoreUsualMeetingPoint(group.id);
              void request.then(place => { if (place) go(place); }).finally(() => setAdopting(false));
            }} />
          {!state.isOnline && <Text style={{ color: soft }}>Reconnect to update the group meeting point.</Text>}
        </>}
        {/* One main button: the best place for this hazard, else the meeting point. */}
        {primary && (
          <AlertButton
            label={primary === best ? `${info?.goPrefix ?? 'Go to'} ${primary.name}${dist(primary)}` : `Go to meeting point: ${primary.name}${dist(primary)}`}
            icon="navigate"
            bg={emergency ? colors.onDanger : colors.primary}
            fg={emergency ? colors.danger : colors.onPrimary}
            tall
            onPress={() => go(primary)}
          />
        )}
        <View style={styles.btnRow}>
          <AlertButton
            label={state.myStatus === 'safe' ? 'Marked safe' : 'I’m safe'}
            icon={state.myStatus === 'safe' ? 'checkmark-circle' : 'checkmark-circle-outline'}
            bg={tonal}
            fg={fg}
            style={styles.half}
            onPress={safe}
          />
          {meeting && meeting !== primary && (
            <AlertButton label="Meeting point" icon="flag" bg={tonal} fg={fg} style={styles.half} onPress={() => go(meeting)} />
          )}
        </View>
        {emergency ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Press and hold to dismiss this emergency alert"
            onLongPress={() => void dismiss()}
            disabled={adopting || ending}
            delayLongPress={800}
            style={styles.dismiss}
          >
            <Text style={[styles.dismissText, { color: fg }]}>{ending ? 'Ending drill…' : 'Press and hold to dismiss'}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => void dismiss()} disabled={adopting || ending} style={styles.dismiss}>
            <Text style={[styles.dismissText, { color: fg }]}>{ending ? 'Ending drill…' : 'Dismiss'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function AlertButton(p: { label: string; icon: ComponentProps<typeof Ionicons>['name']; bg: ColorValue; fg: ColorValue; tall?: boolean; style?: StyleProp<ViewStyle>; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={({ pressed }) => [styles.btn, p.tall && styles.btnTall, p.style, { backgroundColor: p.bg, opacity: pressed ? 0.7 : 1 }]}
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
  headlineXL: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 12 },
  nowCard: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  nowLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  nowText: { flex: 1, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  cardIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  destinationCard: { borderRadius: 16, padding: 14, gap: 12 },
  destinationChoice: { flex: 1, minHeight: 78, padding: 12, gap: 6, borderWidth: 2, borderRadius: 12 },
  labelText: { fontSize: 16, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
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
