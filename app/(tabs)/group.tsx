// [OWNER: UI] Group screen: my status, members, create/join.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { distanceM, formatAge, formatDistance } from '@/lib/geo';
import { geocodeAddress } from '@/services/location';
import { useApp } from '@/state/AppContext';
import { colors, statusColor } from '@/theme';
import type { Member } from '@/types';

export default function GroupScreen() {
  const { state, actions } = useApp();
  const { group, groups, members: allMembers, myLocation, myStatus, isOnline } = state;
  // Everyone else in the CURRENT group (state.members spans all my groups).
  const members = group ? allMembers.filter((m) => group.memberIds.includes(m.uid)) : [];
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [newName, setNewName] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [address, setAddress] = useState('');
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<boolean>, fail: string) => {
    setBusy(true);
    setMsg(null);
    const ok = await fn();
    setBusy(false);
    if (!ok) setMsg(fail);
    else {
      setAdding(false);
      setCode('');
      setNewName('');
    }
  };
  const setHere = () => {
    if (!isOnline) return Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.');
    if (!myLocation) return Alert.alert('No location yet', 'Wait for a GPS fix, or type an address instead.');
    actions.setMeetingPlace(myLocation, placeName.trim() || 'Meeting place', group?.id);
    setPlaceName('');
  };
  const setFromAddress = async () => {
    if (!isOnline) return Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.');
    const typed = address.trim();
    if (!typed) return Alert.alert('Enter an address', 'For example "4060 George Washington Ln NE, Seattle".');
    setFinding(true);
    const coord = await geocodeAddress(typed);
    setFinding(false);
    if (!coord) return Alert.alert("Couldn't find that address", 'Check the spelling, add the city, or drop a pin on the Map tab instead.');
    await actions.setMeetingPlace(coord, placeName.trim() || typed, group?.id, typed);
    setPlaceName('');
    setAddress('');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.statusRow}>
        <StatusButton label="I'm safe" active={myStatus === 'safe'} color={colors.safe} onPress={() => actions.setStatus('safe')} />
        <StatusButton label="Need help" active={myStatus === 'need_help'} color={colors.danger} onPress={() => actions.setStatus('need_help')} />
      </View>

      {groups.length > 0 && (
        <View>
          <Text style={styles.label}>Your groups · tap to make current</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
            {groups.map((g) => {
              const current = !adding && g.id === group?.id;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => { actions.selectGroup(g.id); setAdding(false); }}
                  style={[styles.chip, current && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                >
                  {current && <Ionicons name="checkmark-circle" size={16} color="#fff" />}
                  <Text style={[styles.chipText, current && { color: '#fff' }]}>{g.name}</Text>
                  <Text style={[styles.chipCount, current && { color: '#fff' }]}>{g.memberIds.length}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => { setAdding(true); setMsg(null); }} style={[styles.chip, adding && styles.chipActive]}>
              <Ionicons name="add" size={16} color={adding ? '#fff' : colors.text} />
              <Text style={[styles.chipText, adding && { color: '#fff' }]}>Add group</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {group && !adding ? (
        <>
          <Text style={styles.h1}>{group.name}</Text>
          <Text style={styles.muted}>Invite code: <Text style={styles.code}>{group.inviteCode}</Text></Text>
          <Text style={styles.muted}>
            Meeting place: {group.meetingPlace ? group.meetingPlace.name : 'not set yet'}
            {group.meetingPlace?.address ? ` · ${group.meetingPlace.address}` : ''}
          </Text>
          <View style={styles.box}>
            <Text style={styles.name}>Set meeting place for {group.name}</Text>
            <TextInput style={styles.input} editable={isOnline} placeholder="Name it (e.g. Front lawn)" placeholderTextColor={colors.muted} value={placeName} onChangeText={setPlaceName} />
            <TextInput
              style={styles.input}
              editable={isOnline && !finding}
              placeholder="Address (e.g. 4060 George Washington Ln NE, Seattle)"
              placeholderTextColor={colors.muted}
              value={address}
              onChangeText={setAddress}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => void setFromAddress()}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[styles.btn, { flex: 1 }, (!isOnline || finding) && { opacity: 0.5 }]} disabled={!isOnline || finding} onPress={() => void setFromAddress()}>
                <Text style={styles.btnText}>{finding ? 'Finding…' : 'Use address'}</Text>
              </Pressable>
              <Pressable style={[styles.btn, { flex: 1 }, !isOnline && { opacity: 0.5 }]} disabled={!isOnline} onPress={setHere}>
                <Text style={styles.btnText}>Use my location</Text>
              </Pressable>
            </View>
            <Text style={styles.muted}>{isOnline ? 'Or on the Map tab: hold a spot for 1 second, slide to a group, and let go.' : 'Meeting place changes are locked while offline.'}</Text>
          </View>
          <FlatList
            style={{ marginTop: 12 }}
            data={members}
            keyExtractor={(m) => m.uid}
            renderItem={({ item }) => <MemberRow m={item} me={myLocation} />}
            ListEmptyComponent={<Text style={styles.muted}>No other members yet. Share the invite code.</Text>}
          />
          <Pressable onPress={() => Alert.alert(`Leave ${group.name}?`, 'Your other groups stay. You can rejoin with the invite code.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: actions.leaveGroup }])}>
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 12, textDecorationLine: 'underline' }]}>Leave this group</Text>
          </Pressable>
        </>
      ) : (
        <View style={{ gap: 10, marginTop: 16 }}>
          <Text style={styles.h1}>{groups.length ? 'Add another group' : 'Join or create a group'}</Text>
          <TextInput style={styles.input} placeholder="Invite code" placeholderTextColor={colors.muted} autoCapitalize="characters" value={code} onChangeText={setCode} />
          <Pressable style={styles.btn} disabled={busy} onPress={() => run(() => actions.joinGroup(code), 'Could not join. Check the code and your connection.')}><Text style={styles.btnText}>{busy ? 'Working…' : 'Join'}</Text></Pressable>
          <TextInput style={styles.input} placeholder="New group name" placeholderTextColor={colors.muted} value={newName} onChangeText={setNewName} />
          <Pressable style={styles.btn} disabled={busy} onPress={() => run(() => actions.createGroup(newName || 'My Family'), 'Could not create the group. Check your connection.')}><Text style={styles.btnText}>Create</Text></Pressable>
          {msg && <Text style={{ color: colors.danger }}>{msg}</Text>}
          {adding && group && (
            <Pressable onPress={() => setAdding(false)}>
              <Text style={[styles.muted, { textAlign: 'center', textDecorationLine: 'underline' }]}>Cancel</Text>
            </Pressable>
          )}
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
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '700' },
  chipCount: { color: colors.muted, fontWeight: '600', fontSize: 12 },
});
