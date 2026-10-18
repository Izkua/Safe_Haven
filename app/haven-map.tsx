import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { HAZARDS } from '@/lib/hazards';
import { isHazard, savedHaven } from '@/lib/havens';
import { UW_CENTER } from '@/mocks/demo';
import { useApp } from '@/state/AppContext';
import { colors, radius } from '@/theme';
import type { LatLng } from '@/types';
export default function HavenMapScreen() {
  const params = useLocalSearchParams<{ hazard: string; groupId: string }>();
  const { state, actions } = useApp();
  const insets = useSafeAreaInsets();
  const group = state.groups.find(g => g.id === params.groupId);
  const hazard = isHazard(params.hazard) ? params.hazard : null;
  const previous = hazard ? savedHaven(group, hazard) : null;
  const [point, setPoint] = useState<LatLng | null>(previous?.coord ?? null);
  const [name, setName] = useState(previous?.name ?? '');
  const [busy, setBusy] = useState(false);
  const center = previous?.coord ?? state.myLocation ?? group?.meetingPlace?.coord ?? UW_CENTER;
  const save = async () => {
    if (!point || !group || !hazard || busy) return;
    setBusy(true);
    try {
      if (await actions.saveDisasterHaven(group.id, hazard, point, name.trim() || `${HAZARDS[hazard].label} haven`)) router.back();
    } finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <MapView style={{ flex: 1 }} initialRegion={{ ...center, latitudeDelta: 0.025, longitudeDelta: 0.025 }} showsUserLocation
      onPress={e => { if (state.isOnline && !busy) setPoint(e.nativeEvent.coordinate); }}
      onLongPress={e => { if (state.isOnline && !busy) setPoint(e.nativeEvent.coordinate); }}>
      {point && <Marker coordinate={point} title={name || 'Proposed haven'} pinColor="purple" />}
    </MapView>
    <View style={{ padding: 20, paddingBottom: Math.max(insets.bottom, 16), gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{group?.name ?? 'Group unavailable'} · {hazard ? HAZARDS[hazard].label : 'Invalid disaster'}</Text>
      <Text style={{ color: colors.muted }}>{!state.isOnline ? 'Haven locked while offline.' : point ? 'Point selected. Tap elsewhere to adjust, then save.' : 'Tap the map to select your group’s haven.'}</Text>
      <TextInput accessibilityLabel="Haven name" placeholder="Name this haven" placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={80} editable={!busy && state.isOnline}
        style={{ color: colors.text, backgroundColor: colors.card, padding: 16, borderRadius: radius }} />
      <BigButton label="Save a meeting point" icon="flag-outline" loading={busy} disabled={!point || !group || !hazard || !state.isOnline} onPress={() => void save()} />
    </View>
  </KeyboardAvoidingView>;
}
