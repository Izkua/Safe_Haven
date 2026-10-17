// [OWNER: ALERTS] Shown when an alert affects the user. One tap → route to safety.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { nearestPlace } from '@/lib/geo';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';

export default function AlertScreen() {
  const { state, actions } = useApp();
  const a = state.activeAlert;
  const nearest = state.myLocation && state.group ? nearestPlace(state.myLocation, state.group.safeAreas) : null;

  const go = async (target: 'meeting' | 'nearest') => {
    const place = target === 'meeting' ? state.group?.meetingPlace : nearest;
    if (place) await actions.routeTo(place);
    router.back();
  };

  if (!a) {
    return <View style={styles.screen}><Text style={styles.body}>No active alerts.</Text></View>;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.severity}>{a.severity.toUpperCase()}</Text>
      <Text style={styles.title}>{a.title}</Text>
      <Text style={styles.body}>{a.description}</Text>
      {a.instruction && <Text style={styles.instruction}>{a.instruction}</Text>}

      <View style={{ gap: 10, marginTop: 'auto' }}>
        {state.group?.meetingPlace && (
          <Pressable style={[styles.btn, { backgroundColor: colors.meeting }]} onPress={() => go('meeting')}>
            <Text style={styles.btnText}>Go to meeting place · {state.group.meetingPlace.name}</Text>
          </Pressable>
        )}
        {nearest && (
          <Pressable style={[styles.btn, { backgroundColor: colors.shelter }]} onPress={() => go('nearest')}>
            <Text style={styles.btnText}>Nearest safe area · {nearest.name}</Text>
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
  severity: { color: colors.danger, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  instruction: { color: colors.warn, fontSize: 17, fontWeight: '700', lineHeight: 23 },
  btn: { borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
