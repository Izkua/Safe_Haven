// [OWNER: UI] Group screen: how am I, where is everyone, and a few clear actions.
// Secondary tasks (meeting point, join/create forms) only open when asked for, to keep the screen calm.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ComponentProps } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, type ColorValue } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { distanceM, formatAge, formatDistance } from '@/lib/geo';
import { tap } from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import { colors, minTarget, radius, statusColor } from '@/theme';
import type { LatLng, Member } from '@/types';

const STALE_MS = 60 * 60_000;
const order = { need_help: 0, unknown: 1, safe: 2 } as const;

export default function GroupScreen() {
  const { state, actions } = useApp();
  const { group, members, myLocation, myStatus, isOnline } = state;
  const [mode, setMode] = useState<'none' | 'join' | 'create' | 'meeting'>('none');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Wait for the keyboard to finish opening, then bring the focused box into view.
  const scrollToInput = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);

  const copyCode = async () => {
    if (!group) return;
    await Clipboard.setStringAsync(group.inviteCode).catch(() => {});
    tap();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const open = (m: typeof mode) => {
    setMode(m);
    setText('');
    setMsg(null);
  };
  const run = async (fn: () => Promise<boolean>, fail: string) => {
    setBusy(true);
    setMsg(null);
    const ok = await fn();
    setBusy(false);
    if (ok) setMode('none');
    else setMsg(fail);
  };
  const setHere = () => {
    if (!isOnline) return Alert.alert('You’re offline', 'Reconnect to change the meeting point.');
    if (!myLocation) return Alert.alert('No location yet', 'Wait for GPS, or long-press the map instead.');
    actions.setMeetingPlace(myLocation, text.trim() || 'Meeting point');
    setMode('none');
  };
  const setStatus = (s: 'safe' | 'need_help') => {
    tap();
    actions.setStatus(s);
  };

  // ---- Not in a group yet ----
  if (!group) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView ref={scrollRef} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} accessibilityRole="header">Your group</Text>
          <Text style={styles.lead}>Join your family or friends so you can see each other and meet up in an emergency.</Text>

          {mode === 'join' ? (
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Invite code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="ABC123"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={6}
                value={text}
                onChangeText={setText}
                accessibilityLabel="Invite code"
              />
              <BigButton label="Join group" icon="log-in-outline" loading={busy} disabled={text.trim().length !== 6} onPress={() => run(() => actions.joinGroup(text), 'Couldn’t join. Check the code and your connection.')} />
              <BigButton label="Cancel" variant="plain" onPress={() => open('none')} />
            </View>
          ) : mode === 'create' ? (
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Group name</Text>
              <TextInput style={styles.input} placeholder="Family" placeholderTextColor={colors.muted} autoFocus value={text} onChangeText={setText} accessibilityLabel="Group name" onFocus={scrollToInput} />
              <BigButton label="Create group" icon="add" loading={busy} onPress={() => run(() => actions.createGroup(text.trim() || 'My Family'), 'Couldn’t create the group. Check your connection.')} />
              <BigButton label="Cancel" variant="plain" onPress={() => open('none')} />
            </View>
          ) : (
            <View style={styles.form}>
              <BigButton label="Join with a code" icon="key-outline" onPress={() => open('join')} />
              <BigButton label="Start a new group" icon="add" variant="secondary" onPress={() => open('create')} />
            </View>
          )}
          {msg && <Text style={styles.error} accessibilityRole="alert">{msg}</Text>}
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ---- In a group ----
  const sorted = [...members].sort((a, b) => order[a.status] - order[b.status] || (b.locationTs ?? 0) - (a.locationTs ?? 0));
  const count = members.length + 1;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView ref={scrollRef} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">{group.name}</Text>
        <Text style={styles.lead}>
          {count} {count === 1 ? 'person' : 'people'}. {group.meetingPlace ? `Meet at ${group.meetingPlace.name}.` : 'No meeting point yet.'}
        </Text>

        <Text style={styles.heading}>How are you?</Text>
        <View style={styles.statusRow}>
          <StatusButton
            label="I’m safe"
            icon="checkmark-circle"
            active={myStatus === 'safe'}
            tint={colors.safe}
            fill={colors.safeFill}
            onFill={colors.onSafe}
            onPress={() => setStatus('safe')}
          />
          <StatusButton
            label="I need help"
            icon="alert-circle"
            active={myStatus === 'need_help'}
            tint={colors.dangerText}
            fill={colors.danger}
            onFill={colors.onDanger}
            alarm
            onPress={() => setStatus('need_help')}
          />
        </View>

        <Text style={styles.heading}>People</Text>
        {sorted.length ? (
          <View>
            {sorted.map((m, i) => <MemberRow key={m.uid} m={m} me={myLocation} last={i === sorted.length - 1} />)}
          </View>
        ) : (
          <Text style={styles.body}>No one else has joined yet. Invite them below.</Text>
        )}

        <Text style={styles.heading}>Invite code</Text>
        <View style={styles.codeRow}>
          <Text
            style={styles.codeBig}
            selectable
            accessibilityLabel={`Invite code ${group.inviteCode.split('').join(' ')}`}
          >
            {group.inviteCode}
          </Text>
          <BigButton
            label={copied ? 'Copied' : 'Copy'}
            icon={copied ? 'checkmark' : 'copy-outline'}
            variant={copied ? 'secondary' : 'primary'}
            style={styles.copyBtn}
            accessibilityHint="Copies the invite code"
            onPress={copyCode}
          />
        </View>
        <Text style={styles.hint}>They enter it under Join with a code on their Group tab.</Text>

        {mode === 'meeting' ? (
          <View style={[styles.form, { marginTop: 28 }]}>
            <Text style={styles.fieldLabel}>Meeting point name</Text>
            <TextInput style={styles.input} placeholder="Front lawn" placeholderTextColor={colors.muted} autoFocus value={text} onChangeText={setText} accessibilityLabel="Meeting point name" onFocus={scrollToInput} />
            <BigButton label="Use where I am now" icon="locate" onPress={setHere} />
            <Text style={styles.hint}>Or long-press anywhere on the map.</Text>
            <BigButton label="Cancel" variant="plain" onPress={() => open('none')} />
          </View>
        ) : (
          <View style={[styles.form, { marginTop: 28 }]}>
            <BigButton
              label="Share invite"
              icon="share-outline"
              variant="secondary"
              accessibilityHint={`Shares invite code ${group.inviteCode}`}
              onPress={() => Share.share({ message: `Join my SafeHaven group "${group.name}" with code ${group.inviteCode}` })}
            />
            <BigButton
              label="Change meeting point"
              icon="location-outline"
              variant="secondary"
              disabled={!isOnline}
              onPress={() => open('meeting')}
            />
            {!isOnline && <Text style={styles.hint}>The meeting point can’t change while you’re offline.</Text>}
            <BigButton
              label="Leave group"
              variant="plain"
              tone="danger"
              onPress={() => Alert.alert('Leave this group?', 'You can rejoin with the invite code.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: actions.leaveGroup }])}
            />
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MemberRow({ m, me, last }: { m: Member; me: LatLng | null; last: boolean }) {
  const age = m.locationTs ? Date.now() - m.locationTs : null;
  const help = m.status === 'need_help';
  const stale = age === null || age > STALE_MS;
  const line = help
    ? `Needs help, ${age !== null ? formatAge(age) : 'location unknown'}`
    : m.status === 'safe'
      ? `Safe, ${age !== null ? formatAge(age) : 'location unknown'}`
      : age !== null
        ? `No check-in, seen ${formatAge(age)}`
        : 'No check-in yet';
  const dist = me && m.location ? formatDistance(distanceM(me, m.location)) : null;
  const icon: ComponentProps<typeof Ionicons>['name'] = help ? 'alert-circle' : m.status === 'safe' ? 'checkmark-circle' : 'ellipse-outline';
  return (
    <View style={[styles.row, !last && styles.rowRule]} accessible accessibilityLabel={`${m.name}. ${line}${dist ? `. ${dist} away` : ''}`}>
      <Ionicons name={icon} size={26} color={statusColor[m.status]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{m.name}</Text>
        <Text style={[styles.status, help && styles.statusHelp]}>{line}</Text>
      </View>
      {dist && <Text style={[styles.dist, stale && !help && { color: colors.muted }]}>{dist}</Text>}
    </View>
  );
}

function StatusButton(p: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  tint: ColorValue;
  fill: ColorValue;
  onFill: ColorValue;
  /** Alarm actions show their color as an outline even before they're pressed. */
  alarm?: boolean;
  onPress: () => void;
}) {
  const fg = p.active ? p.onFill : p.tint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: p.active }}
      onPress={p.onPress}
      style={({ pressed }) => [
        styles.statusBtn,
        { backgroundColor: p.active ? p.fill : colors.card, opacity: pressed ? 0.7 : 1 },
        p.alarm && { borderWidth: 2, borderColor: p.active ? p.fill : p.tint },
      ]}
    >
      <Ionicons name={p.icon} size={28} color={fg} />
      <Text style={[styles.statusText, { color: fg }]}>{p.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.text },
  lead: { marginTop: 4, fontSize: 17, lineHeight: 24, color: colors.muted },
  heading: { marginTop: 28, marginBottom: 10, fontSize: 20, lineHeight: 25, fontWeight: '600', color: colors.text },
  body: { fontSize: 17, lineHeight: 24, color: colors.muted },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusBtn: { flex: 1, minHeight: 88, borderRadius: radius, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  statusText: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.rule },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  status: { fontSize: 15, lineHeight: 20, color: colors.muted },
  statusHelp: { color: colors.dangerText, fontWeight: '600' },
  dist: { fontSize: 17, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  form: { marginTop: 24, gap: 10 },
  fieldLabel: { fontSize: 15, color: colors.muted },
  input: { minHeight: minTarget, borderRadius: radius, paddingHorizontal: 16, fontSize: 17, color: colors.text, backgroundColor: colors.card },
  codeInput: { fontSize: 24, fontWeight: '600', letterSpacing: 6, textAlign: 'center' },
  hint: { marginTop: 8, fontSize: 15, lineHeight: 20, color: colors.muted },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius, paddingLeft: 18, paddingRight: 8, paddingVertical: 8 },
  codeBig: { flex: 1, fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: 6, color: colors.text, fontVariant: ['tabular-nums'] },
  copyBtn: { minWidth: 112 },
  error: { marginTop: 16, fontSize: 15, fontWeight: '600', color: colors.dangerText },
});
