// [OWNER: UI] Settings: your name, permissions, appearance, offline, about. Opened from the gear on
// the First aid tab. Kept short on purpose: the app should need almost no setup in an emergency.
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { BigButton } from '@/components/BigButton';
import { useOnboarding } from '@/components/OnboardingGate';
import { loadAppearancePref, setAppearancePref, type AppearancePref } from '@/lib/appearance';
import { pickAvatar, type AvatarSource } from '@/lib/avatar';
import { tap } from '@/lib/haptics';
import { OFFICIAL_NOTE } from '@/lib/hazards';
import { hasNotificationPermission, notificationsAvailable, requestNotificationPermission } from '@/services/alerts';
import { hasForegroundPermission, requestForegroundPermission } from '@/services/location';
import { useApp } from '@/state/AppContext';
import { colors, memberColor, minTarget, radius } from '@/theme';

const APPEARANCE: { value: AppearancePref; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match phone' },
];

const SOURCES: { label: string; detail: string; url: string }[] = [
  { label: 'National Weather Service', detail: 'Weather alerts', url: 'https://www.weather.gov' },
  { label: 'USGS', detail: 'Earthquakes', url: 'https://earthquake.usgs.gov' },
  { label: '© OpenStreetMap contributors', detail: 'Walking route data', url: 'https://www.openstreetmap.org/copyright' },
  { label: 'FOSSGIS', detail: 'Walking route service', url: 'https://routing.openstreetmap.de/about.html' },
];

type Perms = { location: boolean; alerts: boolean } | null;

export default function SettingsScreen() {
  const { state, actions } = useApp();
  const { resetOnboarding } = useOnboarding();
  const [name, setName] = useState(state.myName === 'Me' ? '' : state.myName);
  const [savedName, setSavedName] = useState(false);
  const [phone, setPhone] = useState(state.myPhone ?? '');
  const [savedPhone, setSavedPhone] = useState(false);
  const [picking, setPicking] = useState<AvatarSource | null>(null);
  const [pref, setPref] = useState<AppearancePref | null>(null);
  const [perms, setPerms] = useState<Perms>(null);

  useEffect(() => {
    loadAppearancePref().then(setPref);
  }, []);

  // Re-check permissions when the screen opens and whenever we come back from the iOS Settings app.
  const refreshPerms = useCallback(async () => {
    const [location, alerts] = await Promise.all([hasForegroundPermission(), hasNotificationPermission()]);
    setPerms({ location, alerts });
  }, []);
  useEffect(() => {
    void refreshPerms();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void refreshPerms());
    return () => sub.remove();
  }, [refreshPerms]);

  const trimmed = name.trim();
  const nameChanged = !!trimmed && trimmed !== state.myName;
  const saveName = () => {
    if (!nameChanged) return;
    tap();
    // Don't block on the network; the profile syncs when it can.
    actions.setName(trimmed).catch(() => {});
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
  };

  const phoneChanged = phone.trim() !== (state.myPhone ?? '');
  const savePhone = () => {
    if (!phoneChanged) return;
    tap();
    actions.setPhone(phone);
    setSavedPhone(true);
    setTimeout(() => setSavedPhone(false), 2000);
  };

  const changePhoto = async (source: AvatarSource) => {
    tap();
    setPicking(source);
    const res = await pickAvatar(source);
    setPicking(null);
    if (!res) return; // cancelled
    if ('photo' in res) return actions.setPhoto(res.photo);
    if (res.error === 'denied') {
      const what = source === 'camera' ? 'camera' : 'photos';
      Alert.alert(`${source === 'camera' ? 'Camera' : 'Photo'} access is off`, `Allow SafeHaven to use your ${what} in Settings to set a profile picture.`, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    } else Alert.alert('Couldn’t use that photo', 'Try a different one.');
  };
  const removePhoto = () => {
    tap();
    actions.setPhoto(null);
  };

  // Ask first (only works if the user was never asked); if that doesn't turn it on, open iOS Settings.
  const turnOn = async (request: () => Promise<boolean>) => {
    tap();
    const granted = await request().catch(() => false);
    if (!granted) await Linking.openSettings().catch(() => {});
    void refreshPerms();
  };

  const choose = (p: AppearancePref) => {
    tap();
    setPref(p);
    void setAppearancePref(p);
  };

  const version = Constants.expoConfig?.version ?? '';

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading} accessibilityRole="header">You</Text>
        <View style={styles.photoRow}>
          <Avatar name={state.myName === 'Me' ? '?' : state.myName} photo={state.myPhoto} color={memberColor(state.myUid ?? 'me', [])} size={88} />
          <View style={styles.photoBtns}>
            <BigButton label={state.myPhoto ? 'Take new photo' : 'Take photo'} icon="camera-outline" variant="secondary" loading={picking === 'camera'} disabled={!!picking} onPress={() => void changePhoto('camera')} />
            <BigButton label="Choose from library" icon="images-outline" variant="secondary" loading={picking === 'library'} disabled={!!picking} onPress={() => void changePhoto('library')} />
            {!!state.myPhoto && <BigButton label="Remove photo" variant="plain" onPress={removePhoto} />}
          </View>
        </View>
        <Text style={[styles.hint, styles.gapBottom]}>Your group sees your photo in the group list and on the map.</Text>
        <Text style={styles.fieldLabel}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(t) => { setName(t); setSavedName(false); }}
          placeholder="Your name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={saveName}
          accessibilityLabel="Your name"
        />
        <Text style={styles.hint}>Your group sees this next to your location and status.</Text>
        <BigButton
          label={savedName ? 'Saved' : 'Save name'}
          icon={savedName ? 'checkmark' : undefined}
          variant={savedName ? 'secondary' : 'primary'}
          disabled={!nameChanged && !savedName}
          style={styles.gapTop}
          onPress={saveName}
        />

        <Text style={[styles.fieldLabel, styles.gapTopLg]}>Phone number (optional)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={(t) => { setPhone(t); setSavedPhone(false); }}
          placeholder="e.g. (206) 555-0123"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          returnKeyType="done"
          onSubmitEditing={savePhone}
          accessibilityLabel="Phone number"
        />
        <Text style={styles.hint}>Only people in your groups see it, so they can call or text you. Leave it empty to keep it private.</Text>
        <BigButton
          label={savedPhone ? 'Saved' : phone.trim() || !state.myPhone ? 'Save number' : 'Remove number'}
          icon={savedPhone ? 'checkmark' : undefined}
          variant={savedPhone ? 'secondary' : 'primary'}
          disabled={!phoneChanged && !savedPhone}
          style={styles.gapTop}
          onPress={savePhone}
        />

        <Text style={styles.heading} accessibilityRole="header">Permissions</Text>
        <View style={styles.card}>
          <PermissionRow
            icon="location"
            label="Location"
            on={perms?.location}
            offText="You won't appear on your group's map, and routes can't start from where you are."
            onTurnOn={() => turnOn(requestForegroundPermission)}
          />
          <View style={styles.rule} />
          <PermissionRow
            icon="notifications"
            label="Alerts"
            on={perms?.alerts}
            offText={notificationsAvailable() ? 'You won\'t be notified about disasters, drills or meeting point changes.' : 'Notifications aren\'t available in this build.'}
            onTurnOn={notificationsAvailable() ? () => turnOn(requestNotificationPermission) : undefined}
          />
        </View>

        <Text style={styles.heading} accessibilityRole="header">Appearance</Text>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {APPEARANCE.map((o) => {
            const on = pref === o.value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => choose(o.value)}
                style={({ pressed }) => [styles.segBtn, on && styles.segOn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.heading} accessibilityRole="header">Offline</Text>
        <BigButton
          label="Offline readiness"
          icon="cloud-download-outline"
          variant="secondary"
          accessibilityHint="Checks and saves what you need to use SafeHaven without signal"
          onPress={() => router.push('/offline-readiness')}
        />

        <Text style={styles.heading} accessibilityRole="header">About</Text>
        <Text style={styles.body}>{OFFICIAL_NOTE} SafeHaven isn't affiliated with any government agency, and routes don't avoid hazards.</Text>
        <View style={[styles.card, styles.gapTop]}>
          {SOURCES.map((src, i) => (
            <View key={src.url}>
              {i > 0 && <View style={styles.rule} />}
              <Pressable
                accessibilityRole="link"
                accessibilityHint="Opens in your browser"
                onPress={() => void Linking.openURL(src.url)}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{src.label}</Text>
                  <Text style={styles.rowDetail}>{src.detail}</Text>
                </View>
                <Ionicons name="open-outline" size={20} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
        {!!version && <Text style={[styles.hint, styles.center]}>SafeHaven {version}</Text>}

        {/* Dev builds only: re-run onboarding without reinstalling Expo Go. */}
        {__DEV__ && (
          <View style={styles.gapTop}>
            <BigButton label="Reset onboarding (dev)" variant="plain" onPress={resetOnboarding} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PermissionRow(p: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  /** undefined while checking */
  on: boolean | undefined;
  offText: string;
  onTurnOn?: () => void;
}) {
  const status = p.on === undefined ? 'Checking…' : p.on ? 'On' : 'Off';
  return (
    <View style={styles.permRow} accessible={!p.onTurnOn || p.on !== false} accessibilityLabel={`${p.label}: ${status}`}>
      <View style={styles.row}>
        <Ionicons name={p.icon} size={24} color={colors.text} />
        <Text style={[styles.rowLabel, styles.flex]}>{p.label}</Text>
        {p.on !== undefined && (
          <Ionicons name={p.on ? 'checkmark-circle' : 'close-circle'} size={20} color={p.on ? colors.safe : colors.dangerText} />
        )}
        <Text style={[styles.status, p.on === false && { color: colors.dangerText }, p.on && { color: colors.safe }]}>{status}</Text>
      </View>
      {p.on === false && (
        <>
          <Text style={styles.rowDetail}>{p.offText}</Text>
          {p.onTurnOn && <BigButton label={`Turn on ${p.label.toLowerCase()}`} icon="settings-outline" variant="secondary" style={styles.gapTop} onPress={p.onTurnOn} />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  flex: { flex: 1 },
  heading: { marginTop: 28, marginBottom: 10, fontSize: 20, lineHeight: 25, fontWeight: '600', color: colors.text },
  fieldLabel: { marginBottom: 8, fontSize: 15, color: colors.muted },
  input: { minHeight: minTarget, borderRadius: radius, paddingHorizontal: 16, fontSize: 17, color: colors.text, backgroundColor: colors.card },
  hint: { marginTop: 8, fontSize: 15, lineHeight: 20, color: colors.muted },
  body: { fontSize: 15, lineHeight: 21, color: colors.muted },
  center: { textAlign: 'center', marginTop: 16 },
  gapTop: { marginTop: 12 },
  gapTopLg: { marginTop: 20 },
  gapBottom: { marginBottom: 16 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoBtns: { flex: 1, gap: 6 },
  card: { backgroundColor: colors.card, borderRadius: radius, paddingHorizontal: 14 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.rule },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  rowText: { flex: 1, paddingVertical: 10 },
  rowLabel: { fontSize: 17, fontWeight: '600', color: colors.text },
  rowDetail: { fontSize: 15, lineHeight: 20, color: colors.muted },
  permRow: { paddingBottom: 12 },
  status: { fontSize: 15, fontWeight: '600', color: colors.muted },
  segment: { flexDirection: 'row', gap: 6, backgroundColor: colors.card, borderRadius: radius, padding: 4 },
  segBtn: { flex: 1, minHeight: minTarget - 8, borderRadius: radius - 4, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.primary },
  segText: { fontSize: 15, fontWeight: '600', color: colors.text },
  segTextOn: { color: colors.onPrimary },
});
