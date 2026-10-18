// [OWNER: MAP/OFFLINE] Offline readiness: what's saved for use without signal, and a button to save the rest.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BigButton } from '@/components/BigButton';
import { formatAge } from '@/lib/geo';
import { checkOfflineReadiness, prepareOffline, type Readiness } from '@/services/readiness';
import { useApp } from '@/state/AppContext';
import { colors, radius } from '@/theme';

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
      <Text style={styles.title} accessibilityRole="header">{busy ? 'Preparing…' : checking ? 'Checking saved files…' : report?.ready ? 'Offline essentials saved' : 'Prepare for no signal'}</Text>
      <Text style={styles.lead}>Checks saved meeting places, routes and group information. Apple Maps controls its own map cache; offline street-map coverage is not guaranteed.</Text>
      <View>
        {report?.checks.map((check, i) => {
          const tag = check.id === 'map' ? 'Not guaranteed' : !check.required ? 'Optional' : check.ready ? 'Saved' : 'Needed';
          const needed = tag === 'Needed';
          const icon: ComponentProps<typeof Ionicons>['name'] = check.ready ? 'checkmark-circle' : needed ? 'alert-circle' : 'ellipse-outline';
          return (
            <View key={check.id} style={[styles.row, i < report.checks.length - 1 && styles.rowRule]} accessible accessibilityLabel={`${tag}: ${check.label}. ${check.detail}`}>
              <Ionicons name={icon} size={26} color={check.ready ? colors.safe : needed ? colors.dangerText : colors.muted} />
              <View style={styles.rowText}>
                <Text style={styles.label}>{check.label}</Text>
                <Text style={[styles.tag, check.ready && { color: colors.safe }, needed && { color: colors.dangerText }]}>{tag}</Text>
                <Text style={styles.muted}>{check.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>
      {message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
      <BigButton label={busy ? 'Preparing…' : 'Prepare for offline'} icon="cloud-download-outline" loading={busy} disabled={busy || !state.isOnline} onPress={() => void prepare()} />
      {!state.isOnline && <Text style={styles.muted}>You can check saved files offline. Reconnect to refresh anything missing.</Text>}
      <BigButton label="Check again" icon="refresh" variant="secondary" disabled={busy || checking} onPress={() => void refresh()} />
      {report && <Text style={styles.muted}>Checked {formatAge(Date.now() - report.checkedAt)}. Readiness changes if you move or choose another destination.</Text>}
      <Text style={styles.muted}>This screen saves app data, not Apple map tiles. A saved route does not account for new hazards. In Expo Go, reopening the app itself may still need the development server.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 16 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.text },
  lead: { fontSize: 17, lineHeight: 24, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 12 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.rule },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 17, fontWeight: '600', color: colors.text },
  tag: { fontSize: 15, fontWeight: '600', color: colors.muted },
  muted: { fontSize: 15, lineHeight: 21, color: colors.muted },
  message: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text, backgroundColor: colors.card, borderRadius: radius, padding: 14, overflow: 'hidden' },
});
