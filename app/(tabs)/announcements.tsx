// [OWNER: UI] Announcements tab: send one to any of your groups (one or several), and see the last 10 (kept on this
// phone) with who has seen each. The gear opens Settings.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnnouncementCard } from '@/components/AnnouncementCard';
import { BigButton } from '@/components/BigButton';
import { DETAILS_MAX, TITLE_MAX } from '@/lib/announcements';
import { tap } from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import { colors, groupColor, minTarget, radius } from '@/theme';

export default function AnnouncementsScreen() {
  const { state, actions } = useApp();
  const { group, groups, announcements } = state;
  const [composing, setComposing] = useState(false);
  // Which groups get it (starts as the current one). Groups you've since left drop out.
  const [picked, setPicked] = useState<string[]>([]);
  const to = groups.filter((g) => picked.includes(g.id));
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const start = () => {
    tap();
    setPicked(group ? [group.id] : []);
    setComposing(true);
  };
  const toggle = (id: string) => {
    tap();
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const cancel = () => {
    setComposing(false);
    setTitle('');
    setDetails('');
  };
  const send = async () => {
    setSending(true);
    const results = await Promise.all(to.map((g) => actions.sendAnnouncement(title, details, g.id)));
    const ok = results.length > 0 && results.every(Boolean);
    setSending(false);
    if (ok) {
      tap();
      cancel();
    } else {
      Alert.alert('Couldn’t send', 'Check that you’re signed in and in a group, then try again.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={[styles.title, styles.flex]} accessibilityRole="header">Announcements</Text>
            <Pressable
              onPress={() => { tap(); router.push('/settings'); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={({ pressed }) => [styles.gear, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="settings-outline" size={24} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.lead}>Everyone in your group gets a banner and a notification that stays until they dismiss it.</Text>

          {!group ? (
            <Text style={[styles.body, styles.gapTop]}>Join or start a group on the Group tab to send announcements.</Text>
          ) : composing ? (
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>To</Text>
              <View style={styles.chips}>
                {groups.map((g) => {
                  const on = picked.includes(g.id);
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => toggle(g.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${g.name}, ${g.memberIds.length} ${g.memberIds.length === 1 ? 'person' : 'people'}`}
                      style={({ pressed }) => [styles.chip, on && styles.chipOn, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      {on ? (
                        <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                      ) : (
                        <View style={[styles.chipDot, { backgroundColor: groupColor(g.id, groups.map((x) => x.id)) }]} />
                      )}
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{g.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Everyone meet at my house at 5:00"
                placeholderTextColor={colors.muted}
                autoFocus
                maxLength={TITLE_MAX}
                accessibilityLabel={`Announcement, up to ${TITLE_MAX} characters`}
              />
              <Counter used={title.length} max={TITLE_MAX} />
              <TextInput
                style={[styles.input, styles.detailsInput]}
                value={details}
                onChangeText={setDetails}
                placeholder="Details (optional)"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={DETAILS_MAX}
                accessibilityLabel={`Announcement details, optional, up to ${DETAILS_MAX} characters`}
              />
              <Counter used={details.length} max={DETAILS_MAX} />
              <BigButton
                label={to.length === 1 ? `Send to ${to[0].name}` : to.length ? `Send to ${to.length} groups` : 'Pick a group'}
                icon="megaphone"
                loading={sending}
                disabled={!title.trim() || !to.length}
                accessibilityHint="Everyone in the chosen groups gets a banner and a notification"
                onPress={() => void send()}
              />
              <BigButton label="Cancel" variant="plain" onPress={cancel} />
            </View>
          ) : (
            <BigButton
              label="Send an announcement"
              icon="megaphone-outline"
              style={styles.gapTop}
              accessibilityHint="Choose which groups get a banner and a notification"
              onPress={start}
            />
          )}

          <Text style={styles.heading} accessibilityRole="header">Recent</Text>
          {announcements.length > 0 ? (
            <View>
              {announcements.map((a, i) => (
                <View key={a.id} style={[styles.item, i < announcements.length - 1 && styles.rule]}>
                  <AnnouncementCard a={a} showSeen />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.body}>No announcements yet. The last 10 are kept on this phone.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** "23/140" under a field; full-strength text once the limit is reached. */
function Counter({ used, max }: { used: number; max: number }) {
  const full = used >= max;
  return (
    <Text style={[styles.counter, full && styles.counterFull]} accessibilityLabel={`${used} of ${max} characters used`}>
      {full ? `Limit reached, ${max}/${max}` : `${used}/${max}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.text },
  gear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  lead: { marginTop: 4, fontSize: 17, lineHeight: 24, color: colors.muted },
  heading: { marginTop: 28, marginBottom: 4, fontSize: 20, lineHeight: 25, fontWeight: '600', color: colors.text },
  body: { fontSize: 17, lineHeight: 24, color: colors.muted },
  gapTop: { marginTop: 20 },
  form: { marginTop: 20, gap: 10 },
  fieldLabel: { fontSize: 15, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary },
  chipDot: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: '#FFFFFF', transform: [{ rotate: '45deg' }] },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  chipTextOn: { color: colors.onPrimary },
  input: { minHeight: minTarget, borderRadius: radius, paddingHorizontal: 16, fontSize: 17, color: colors.text, backgroundColor: colors.card },
  counter: { marginTop: -4, alignSelf: 'flex-end', fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  counterFull: { color: colors.text, fontWeight: '600' },
  detailsInput: { minHeight: 80, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' },
  item: { paddingVertical: 14 },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.rule },
});
