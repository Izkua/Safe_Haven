// [OWNER: ALERTS] Shown when an alert affects the user: what to do now, then one tap to route to safety.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { nearestPlace } from '@/lib/geo';
import { HAZARDS, meetingPlaceOk, OFFICIAL_NOTE, OUTSIDE_STEPS, pickSafeTarget } from '@/lib/hazards';
import { isUserAffected } from '@/services/alerts';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';
import type { Place } from '@/types';

export default function AlertScreen() {
  const { state, actions } = useApp();
  const a = state.activeAlert;
  const me = state.myLocation;

  if (!a) {
    return <View style={styles.screen}><Text style={styles.body}>No active alerts.</Text></View>;
  }

  const info = a.hazard ? HAZARDS[a.hazard] : null;
  // Unknown location: assume affected, so the user still sees the safety steps.
  const affected = me ? isUserAffected(a, me) : true;
  const steps = affected ? info?.steps ?? (a.instruction ? [a.instruction] : []) : OUTSIDE_STEPS;

  const group = state.group;
  const best: Place | null = me
    ? a.hazard ? pickSafeTarget(a.hazard, me, group) : group ? nearestPlace(me, group.safeAreas) : null
    : null;
  const myMeeting = group ? group.meetingPlace : state.personalMeetingPlace;
  const meeting = myMeeting && (!a.hazard || meetingPlaceOk(a.hazard)) ? myMeeting : null;

  const go = async (place: Place) => {
    await actions.routeTo(place);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
        <View style={styles.header}>
          {info && <Ionicons name={info.icon} size={30} color={colors.danger} />}
          <Text style={styles.severity}>{a.severity.toUpperCase()}{info ? ` · ${info.label.toUpperCase()}` : ''}</Text>
        </View>
        <Text style={styles.title}>{a.title}</Text>
        <Text style={styles.body}>{a.description}</Text>

        <View style={[styles.badge, { backgroundColor: affected ? colors.danger : colors.safe }]}>
          <Text style={styles.badgeText}>{affected ? 'You are in the affected area' : 'You are outside the affected area'}</Text>
        </View>

        <Text style={styles.section}>{affected ? 'What to do now' : 'Stay ready'}</Text>
        {steps.map((s, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}

        {affected && info && <Text style={styles.moveNote}>{info.moveNote}</Text>}
        <Text style={styles.official}>{OFFICIAL_NOTE}</Text>
      </ScrollView>

      <View style={{ gap: 10 }}>
        {affected && best && (
          <Pressable style={[styles.btn, { backgroundColor: colors.shelter }]} onPress={() => go(best)}>
            <Text style={styles.btnText}>Safest nearby place · {best.name}</Text>
          </Pressable>
        )}
        {meeting && meeting.id !== best?.id && (
          <Pressable style={[styles.btn, { backgroundColor: colors.meeting }]} onPress={() => go(meeting)}>
            <Text style={styles.btnText}>Go to meeting place · {meeting.name}</Text>
          </Pressable>
        )}
        <Pressable style={[styles.btn, { backgroundColor: colors.card }]} onPress={() => { actions.dismissAlert(); router.back(); }}>
          <Text style={styles.btnText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, backgroundColor: colors.bg, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  severity: { color: colors.danger, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  badge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: '#fff', fontWeight: '700' },
  section: { color: colors.warn, fontSize: 18, fontWeight: '800', marginTop: 6 },
  step: { flexDirection: 'row', gap: 10, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  stepNum: { color: colors.warn, fontWeight: '800', fontSize: 16, width: 18 },
  stepText: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 22 },
  moveNote: { color: colors.warn, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  official: { color: colors.muted, fontSize: 13 },
  btn: { borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
