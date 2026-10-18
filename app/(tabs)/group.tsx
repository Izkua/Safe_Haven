// [OWNER: UI] Group screen: my status, members, meeting place, create/join.
// Design: invite code label, big group name, safe / need-help pair, ruled member list.
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { BigNumber } from '@/components/BigNumber';
import { distanceM, formatAge } from '@/lib/geo';
import { tap } from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import { colors, minTarget, radius, statusColor } from '@/theme';
import type { LatLng, Member } from '@/types';

const STALE_MS = 60 * 60_000;
const order = { need_help: 0, unknown: 1, safe: 2 } as const;

export default function GroupScreen() {
  const { state, actions } = useApp();
  const { group, members, myLocation, myStatus } = state;
  const [code, setCode] = useState('');
  const [newName, setNewName] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<boolean>, fail: string) => {
    setBusy(true);
    setMsg(null);
    const ok = await fn();
    setBusy(false);
    if (!ok) setMsg(fail);
  };
  const setHere = () => {
    if (!myLocation) return Alert.alert('No location yet', 'Wait for a GPS fix, or long-press the map instead.');
    actions.setMeetingPlace(myLocation, placeName.trim() || 'Meeting place');
    setPlaceName('');
  };
  const setStatus = (s: 'safe' | 'need_help') => {
    tap();
    actions.setStatus(s);
  };

  const sorted = [...members].sort(
    (a, b) => order[a.status] - order[b.status] || (b.locationTs ?? 0) - (a.locationTs ?? 0),
  );

  if (!group) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>No group yet</Text>
          <Text style={styles.h1} accessibilityRole="header">Join your people</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Join with a code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="ABC123"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              value={code}
              onChangeText={setCode}
              accessibilityLabel="Invite code"
            />
            <BigButton label="Join group" loading={busy} onPress={() => run(() => actions.joinGroup(code), 'Could not join. Check the code and your connection.')} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Or start a new group</Text>
            <TextInput style={styles.input} placeholder="Group name, e.g. Family" placeholderTextColor={colors.muted} value={newName} onChangeText={setNewName} accessibilityLabel="New group name" />
            <BigButton label="Create group" variant="secondary" loading={busy} onPress={() => run(() => actions.createGroup(newName.trim() || 'My Family'), 'Could not create the group. Check your connection.')} />
          </View>
          {msg && <Text style={styles.error}>{msg}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Share the invite code"
          onPress={() => Share.share({ message: `Join my SafeHaven group "${group.name}" with code ${group.inviteCode}` })}
        >
          <Text style={styles.label}>Invite code <Text style={styles.code}>{group.inviteCode}</Text> · share</Text>
        </Pressable>
        <Text style={styles.h1} accessibilityRole="header">{group.name}</Text>

        <View style={styles.statusRow}>
          <StatusButton label="I'm safe" active={myStatus === 'safe'} color={colors.text} activeText={colors.onPrimary} onPress={() => setStatus('safe')} />
          <StatusButton label="Need help" active={myStatus === 'need_help'} color={colors.danger} activeText={colors.onDanger} onPress={() => setStatus('need_help')} />
        </View>

        <View style={styles.list}>
          {sorted.length ? (
            sorted.map((m) => <MemberRow key={m.uid} m={m} me={myLocation} />)
          ) : (
            <Text style={[styles.body, { paddingVertical: 18 }]}>No one else yet. Share the invite code.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Meeting point</Text>
          <Text style={styles.sectionTitle}>{group.meetingPlace ? group.meetingPlace.name : 'Not set yet'}</Text>
          <TextInput style={styles.input} placeholder="Name it, e.g. Front lawn" placeholderTextColor={colors.muted} value={placeName} onChangeText={setPlaceName} accessibilityLabel="Meeting place name" />
          <BigButton label="Set to my current location" variant="secondary" onPress={setHere} />
          <Text style={styles.hint}>Or long-press anywhere on the map.</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.leave}
          onPress={() => Alert.alert('Leave group?', 'You can rejoin with the invite code.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: actions.leaveGroup }])}
        >
          <Text style={styles.leaveText}>Leave group / join another</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MemberRow({ m, me }: { m: Member; me: LatLng | null }) {
  const age = m.locationTs ? Date.now() - m.locationTs : null;
  const help = m.status === 'need_help';
  const silent = m.status === 'unknown' || age === null || age > STALE_MS;
  const line = help
    ? `Needs help · ${age !== null ? formatAge(age) : 'location unknown'}`
    : m.status === 'safe'
      ? `Safe · ${age !== null ? formatAge(age) : 'location unknown'}`
      : age !== null
        ? `No update for ${formatAge(age).replace(' ago', '')}`
        : 'No update yet';
  return (
    <View style={styles.row} accessible accessibilityLabel={`${m.name}. ${line}`}>
      <View style={[styles.marker, m.status === 'unknown' ? styles.markerHollow : { backgroundColor: statusColor[m.status] }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{m.name}</Text>
        <Text style={[styles.status, help && styles.statusHelp]}>{line}</Text>
      </View>
      <BigNumber meters={me && m.location ? distanceM(me, m.location) : null} size={30} color={silent && !help ? colors.muted : colors.text} />
    </View>
  );
}

function StatusButton({ label, active, color, activeText, onPress }: { label: string; active: boolean; color: string; activeText: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.statusBtn, { borderColor: color, backgroundColor: active ? color : 'transparent', opacity: pressed ? 0.75 : 1 }]}
    >
      <Text style={[styles.statusText, { color: active ? activeText : color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  label: { fontSize: 16, fontWeight: '600', color: colors.muted },
  code: { color: colors.text, fontWeight: '700', letterSpacing: 2 },
  h1: { marginTop: 6, fontSize: 40, lineHeight: 42, fontWeight: '700', color: colors.text },
  statusRow: { marginTop: 24, flexDirection: 'row', gap: 8 },
  statusBtn: { flex: 1, height: 60, borderWidth: 2, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 19, fontWeight: '700' },
  list: { marginTop: 32, borderTopWidth: 1, borderColor: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.rule },
  marker: { width: 12, height: 12 },
  markerHollow: { width: 10, height: 10, borderWidth: 1, borderColor: colors.text, margin: 1 },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  status: { fontSize: 16, color: colors.muted },
  statusHelp: { color: colors.danger, fontWeight: '700' },
  body: { fontSize: 18, lineHeight: 26, color: colors.text },
  section: { marginTop: 32, gap: 10, borderTopWidth: 1, borderColor: colors.text, paddingTop: 16 },
  sectionTitle: { fontSize: 24, lineHeight: 27, fontWeight: '700', color: colors.text },
  input: { minHeight: minTarget, borderWidth: 1, borderColor: colors.text, borderRadius: radius, paddingHorizontal: 14, fontSize: 18, color: colors.text, backgroundColor: colors.bg },
  codeInput: { fontSize: 26, fontWeight: '700', letterSpacing: 6 },
  hint: { fontSize: 15, color: colors.muted },
  error: { marginTop: 16, fontSize: 16, fontWeight: '700', color: colors.danger },
  leave: { marginTop: 32, minHeight: 48, justifyContent: 'center' },
  leaveText: { fontSize: 16, fontWeight: '600', color: colors.text, textDecorationLine: 'underline' },
});
