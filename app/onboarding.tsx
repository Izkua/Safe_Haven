// [OWNER: UI] First-launch flow: welcome → name → location → notifications → create/join group.
// Shown once (see OnboardingGate); finishing flips the gate and the root stack shows the map.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { useOnboarding } from '@/components/OnboardingGate';
import { requestNotificationPermission } from '@/services/alerts';
import { requestForegroundPermission } from '@/services/location';
import { useApp } from '@/state/AppContext';
import { colors, radius } from '@/theme';

const STEPS = ['welcome', 'name', 'location', 'notifications', 'group'] as const;
type Step = (typeof STEPS)[number];
type Permission = 'unasked' | 'asking' | 'denied';

export default function OnboardingScreen() {
  const { state, actions } = useApp();
  const { finishOnboarding } = useOnboarding();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(state.myName === 'Me' ? '' : state.myName);
  const [locationPerm, setLocationPerm] = useState<Permission>('unasked');
  const [notifPerm, setNotifPerm] = useState<Permission>('unasked');

  const index = STEPS.indexOf(step);
  const next = () => {
    const following = STEPS[index + 1];
    // Already in a group (demo mode, or restored from Firestore)? Nothing left to do.
    if (following === 'group' && state.group) return void finishOnboarding();
    setStep(following);
  };
  const back = () => setStep(STEPS[index - 1]);

  const askPermission = async (request: () => Promise<boolean>, setPerm: (p: Permission) => void) => {
    setPerm('asking');
    const granted = await request().catch(() => false);
    if (granted) next();
    else setPerm('denied');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.topBar}>
          {index > 0 ? (
            <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.dot, i <= index && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.back} />
        </View>

        {step === 'welcome' && (
          <Page
            icon="shield-checkmark"
            title="Welcome to SafeHaven"
            body="Get warned about disasters near you, find your way to safety, and keep your group together, even when there's no signal."
          >
            <BigButton label="Get started" onPress={next} />
          </Page>
        )}

        {step === 'name' && (
          <Page icon="person" title="What's your name?" body="Your group sees this next to your location and status.">
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => name.trim() && saveName()}
            />
            <BigButton label="Continue" onPress={saveName} disabled={!name.trim()} />
          </Page>
        )}

        {step === 'location' && (
          <Page
            icon="location"
            title="Share your location"
            body="SafeHaven uses your location to show you on the map, route you to safety, and let your group find you. GPS works without cell service."
          >
            <PermissionActions
              perm={locationPerm}
              allowLabel="Allow location"
              deniedText="Location is off. You can still use SafeHaven, but you won't appear on the map and routes won't start from where you are."
              onAllow={() => askPermission(requestForegroundPermission, setLocationPerm)}
              onSkip={next}
            />
          </Page>
        )}

        {step === 'notifications' && (
          <Page
            icon="notifications"
            title="Get disaster alerts"
            body="We'll notify you when an earthquake, flood, fire or severe weather warning affects your area."
          >
            <PermissionActions
              perm={notifPerm}
              allowLabel="Allow alerts"
              deniedText="Alerts are off. Check the app yourself during an emergency, or turn them on in Settings."
              onAllow={() => askPermission(requestNotificationPermission, setNotifPerm)}
              onSkip={next}
            />
          </Page>
        )}

        {step === 'group' && <GroupStep onDone={finishOnboarding} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  function saveName() {
    // Don't block on the network; the profile syncs when it can.
    actions.setName(name.trim()).catch(() => {});
    next();
  }
}

function GroupStep({ onDone }: { onDone: () => void }) {
  const { state, actions } = useApp();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [groupName, setGroupName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Actions don't return success, so read the result from state: once a group appears we're done.
  if (state.group) {
    return (
      <Page icon="people" title={`You're in ${state.group.name}`} body={`Invite code: ${state.group.inviteCode}. Share it from the Group tab.`}>
        <BigButton label="Go to the map" icon="map" onPress={onDone} />
      </Page>
    );
  }

  const canReachServer = state.isOnline && !!state.myUid;
  const failed = attempted && !busy;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setAttempted(false);
    await action().catch(() => {});
    setBusy(false);
    setAttempted(true);
  };

  const offlineNote = !canReachServer && (
    <Text style={styles.warn}>No connection right now. You can skip this and join a group later from the Group tab.</Text>
  );
  const skip = <BigButton label="Skip for now" variant="secondary" onPress={onDone} />;

  if (mode === 'create') {
    return (
      <Page icon="people" title="Name your group" body="For example “Family” or “Roommates”. You'll get a code to share with them.">
        <TextInput
          style={styles.input}
          placeholder="Group name"
          placeholderTextColor={colors.muted}
          value={groupName}
          onChangeText={setGroupName}
          autoFocus
          autoCapitalize="words"
        />
        {offlineNote}
        {failed && <Text style={styles.error}>Couldn't create the group. Check your connection and try again.</Text>}
        <BigButton
          label="Create group"
          loading={busy}
          disabled={!canReachServer}
          onPress={() => run(() => actions.createGroup(groupName.trim() || 'My Family'))}
        />
        <BigButton label="Back" variant="secondary" onPress={() => setMode('choose')} />
      </Page>
    );
  }

  if (mode === 'join') {
    const cleaned = code.trim().toUpperCase();
    return (
      <Page icon="key" title="Enter invite code" body="Ask someone in the group for their 6-character code. It's on their Group tab.">
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="ABC123"
          placeholderTextColor={colors.muted}
          value={code}
          onChangeText={setCode}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />
        {offlineNote}
        {failed && <Text style={styles.error}>Couldn't join. Check the code and your connection, then try again.</Text>}
        <BigButton
          label="Join group"
          loading={busy}
          disabled={!canReachServer || cleaned.length !== 6}
          onPress={() => run(() => actions.joinGroup(cleaned))}
        />
        <BigButton label="Back" variant="secondary" onPress={() => setMode('choose')} />
      </Page>
    );
  }

  return (
    <Page icon="people" title="Join your people" body="Create a group for your family or friends, or join one with an invite code.">
      {offlineNote}
      <BigButton label="Create a group" icon="add-circle" onPress={() => setMode('create')} />
      <BigButton label="Join with a code" icon="key" variant="secondary" onPress={() => setMode('join')} />
      {skip}
    </Page>
  );
}

function PermissionActions(props: {
  perm: Permission;
  allowLabel: string;
  deniedText: string;
  onAllow: () => void;
  onSkip: () => void;
}) {
  if (props.perm === 'denied') {
    return (
      <>
        <Text style={styles.warn}>{props.deniedText}</Text>
        <BigButton label="Open Settings" icon="settings" variant="secondary" onPress={() => Linking.openSettings()} />
        <BigButton label="Continue" onPress={props.onSkip} />
      </>
    );
  }
  return (
    <>
      <BigButton label={props.allowLabel} loading={props.perm === 'asking'} onPress={props.onAllow} />
      <BigButton label="Not now" variant="secondary" onPress={props.onSkip} />
    </>
  );
}

function Page({ icon, title, body, children }: { icon: ComponentProps<typeof Ionicons>['name']; title: string; body: string; children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Ionicons name={icon} size={64} color={colors.text} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <View style={styles.actions}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 48 },
  back: { flexDirection: 'row', alignItems: 'center', minWidth: 80, minHeight: 48 },
  backText: { color: colors.text, fontSize: 17 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rule },
  dotActive: { backgroundColor: colors.text },
  page: { flexGrow: 1, justifyContent: 'space-between', padding: 24, gap: 32 },
  hero: { alignItems: 'center', gap: 14, marginTop: 40, paddingHorizontal: 8 },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  body: { color: colors.muted, fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 340 },
  actions: { gap: 12 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: radius, paddingHorizontal: 16, minHeight: 56, fontSize: 17 },
  codeInput: { textAlign: 'center', fontSize: 26, fontWeight: '700', letterSpacing: 6 },
  warn: { color: colors.text, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  error: { color: colors.dangerText, fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
