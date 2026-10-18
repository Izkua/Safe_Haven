import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatAge } from '@/lib/geo';
import { checkOfflineReadiness, prepareOffline, type Readiness } from '@/services/readiness';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';

export default function OfflineReadinessScreen() {
  const { state, actions } = useApp();
  const latest = useRef(state); latest.current = state;
  const [report, setReport] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    setChecking(true);
    try {
      const next = await checkOfflineReadiness(latest.current);
      if (id === generation.current) setReport(next);
    } catch { if (id === generation.current) { setReport(null); setMessage('Could not verify saved files. Please check again.'); } }
    finally { if (id === generation.current) setChecking(false); }
  }, []);
  const place = state.group ? state.group.meetingPlace : state.personalMeetingPlace;
  const signature = `${state.group?.id ?? ''}:${place?.id}:${place?.coord.latitude}:${place?.coord.longitude}:${state.tiles?.downloadedAt}:${state.route?.fetchedAt}:${state.myUid}:${state.group?.memberIds.join(',')}:${state.myLocation?.latitude.toFixed(3)}:${state.myLocation?.longitude.toFixed(3)}`;
  useEffect(() => {
    setReport(null); void refresh();
    const timer = setInterval(() => { void refresh(); }, 30000);
    const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') void refresh(); });
    return () => { generation.current++; clearInterval(timer); subscription.remove(); };
  }, [signature, refresh]);
  const prepare = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage(null); setReport(null);
    try {
      await prepareOffline(() => latest.current, () => latest.current.isOnline, setMessage, actions.setPreparedOffline);
      setMessage('Saved. Any remaining items below need attention.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Preparation failed. Please retry.'); }
    finally { await refresh(); lock.current = false; setBusy(false); }
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{busy ? 'Preparing…' : checking ? 'Checking saved files…' : report?.ready ? 'Offline essentials saved' : 'Prepare for no signal'}</Text>
      <Text style={styles.muted}>Checks saved meeting places, routes and group information. Apple Maps controls its own map cache; offline street-map coverage is not guaranteed.</Text>
      {report?.checks.map((check) => (
        <View key={check.id} style={styles.row}>
          <Text style={[styles.label, { color: check.ready ? colors.safe : !check.required ? colors.muted : colors.warn }]}>{check.id === 'map' ? 'Not guaranteed' : !check.required ? 'Optional' : check.ready ? 'Saved' : 'Needed'} · {check.label}</Text>
          <Text style={styles.muted}>{check.detail}</Text>
        </View>
      ))}
      {message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
      <Pressable accessibilityRole="button" disabled={busy || !state.isOnline} onPress={prepare} style={[styles.button, (busy || !state.isOnline) && styles.disabled]}>
        <Text style={styles.buttonText}>{busy ? 'Preparing…' : 'Prepare for offline'}</Text>
      </Pressable>
      {!state.isOnline && <Text style={styles.muted}>You can check saved files offline. Reconnect to refresh anything missing.</Text>}
      <Pressable accessibilityRole="button" disabled={busy || checking} onPress={() => { void refresh(); }} style={styles.secondary}><Text style={styles.buttonText}>Check again</Text></Pressable>
      {report && <Text style={styles.muted}>Checked {formatAge(Date.now() - report.checkedAt)}. Readiness changes if you move or choose another destination.</Text>}
      <Text style={styles.muted}>This screen saves app data, not Apple map tiles. A saved route does not account for new hazards. In Expo Go, reopening the app itself may still need the development server.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 20, gap: 16, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' }, muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.muted, gap: 6 }, label: { fontSize: 17, fontWeight: '600' },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' }, disabled: { opacity: 0.45 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' }, secondary: { padding: 14, alignItems: 'center' }, message: { color: colors.warn, lineHeight: 21 },
});
