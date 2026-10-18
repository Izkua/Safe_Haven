// [OWNER: UI] Group screen: my status, members, create/join.
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { distanceM, formatAge, formatDistance } from '@/lib/geo';
import { useApp } from '@/state/AppContext';
import { colors, statusColor } from '@/theme';
import type { Member } from '@/types';

export default function GroupScreen() {
  const { state, actions } = useApp();
  const { group, members, myLocation, myStatus, isOnline } = state;
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
    if (!isOnline) return Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.');
    if (!myLocation) return Alert.alert('No location yet', 'Wait for a GPS fix, or long-press the map instead.');
    actions.setMeetingPlace(myLocation, placeName.trim() || 'Meeting place');
    setPlaceName('');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.statusRow}>
        <StatusButton label="I'm safe" active={myStatus === 'safe'} color={colors.safe} onPress={() => actions.setStatus('safe')} />
        <StatusButton label="Need help" active={myStatus === 'need_help'} color={colors.danger} onPress={() => actions.setStatus('need_help')} />
      </View>

      {group ? (
        <>
          <Text style={styles.h1}>{group.name}</Text>
          <Text style={styles.muted}>Invite code: <Text style={styles.code}>{group.inviteCode}</Text></Text>
          <Text style={styles.muted}>Meeting place: {group.meetingPlace ? group.meetingPlace.name : 'not set yet'}</Text>
          <View style={styles.box}>
            <Text style={styles.name}>Set meeting place</Text>
            <TextInput style={styles.input} editable={isOnline} placeholder="Name it (e.g. Front lawn)" placeholderTextColor={colors.muted} value={placeName} onChangeText={setPlaceName} />
            <Pressable style={[styles.btn, !isOnline && { opacity: 0.5 }]} disabled={!isOnline} onPress={setHere}><Text style={styles.btnText}>Use my current location</Text></Pressable>
            <Text style={styles.muted}>{isOnline ? 'Or long-press anywhere on the Map tab to drop it there.' : 'Meeting place changes are locked while offline.'}</Text>
          </View>
          <FlatList
            style={{ marginTop: 12 }}
            data={members}
            keyExtractor={(m) => m.uid}
            renderItem={({ item }) => <MemberRow m={item} me={myLocation} />}
            ListEmptyComponent={<Text style={styles.muted}>No other members yet. Share the invite code.</Text>}
          />
          <Pressable onPress={() => Alert.alert('Leave group?', 'You can rejoin with the invite code.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: actions.leaveGroup }])}>
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 12, textDecorationLine: 'underline' }]}>Leave group / join another</Text>
          </Pressable>
        </>
      ) : (
        <View style={{ gap: 10, marginTop: 16 }}>
          <Text style={styles.h1}>Join or create a group</Text>
          <TextInput style={styles.input} placeholder="Invite code" placeholderTextColor={colors.muted} autoCapitalize="characters" value={code} onChangeText={setCode} />
          <Pressable style={styles.btn} disabled={busy} onPress={() => run(() => actions.joinGroup(code), 'Could not join. Check the code and your connection.')}><Text style={styles.btnText}>{busy ? 'Working…' : 'Join'}</Text></Pressable>
          <TextInput style={styles.input} placeholder="New group name" placeholderTextColor={colors.muted} value={newName} onChangeText={setNewName} />
          <Pressable style={styles.btn} disabled={busy} onPress={() => run(() => actions.createGroup(newName || 'My Family'), 'Could not create the group. Check your connection.')}><Text style={styles.btnText}>Create</Text></Pressable>
          {msg && <Text style={{ color: colors.danger }}>{msg}</Text>}
        </View>
      )}
    </View>
  );
}

function MemberRow({ m, me }: { m: Member; me: { latitude: number; longitude: number } | null }) {
  const dist = me && m.location ? formatDistance(distanceM(me, m.location)) : '—';
  const seen = m.locationTs ? formatAge(Date.now() - m.locationTs) : 'never';
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: statusColor[m.status] }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{m.name}</Text>
        <Text style={styles.muted}>{m.status.replace('_', ' ')} · seen {seen}</Text>
      </View>
      <Text style={styles.muted}>{dist}</Text>
    </View>
  );
}

function StatusButton({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.statusBtn, { borderColor: color, backgroundColor: active ? color : 'transparent' }]}>
      <Text style={[styles.btnText, { color: active ? '#fff' : color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, backgroundColor: colors.bg },
  statusRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statusBtn: { flex: 1, borderWidth: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  h1: { color: colors.text, fontSize: 22, fontWeight: '700' },
  muted: { color: colors.muted, marginTop: 2 },
  code: { color: colors.text, fontWeight: '700', letterSpacing: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.card },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  box: { backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 8, marginTop: 12 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: 10, padding: 12 },
  btn: { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
