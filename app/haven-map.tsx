import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
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
  const [address, setAddress] = useState(previous?.address ?? '');
  const [searching, setSearching] = useState(false);
  const searchVersion = useRef(0);
  const map = useRef<MapView>(null);
  useEffect(() => () => { searchVersion.current++; }, []);
  const pick = (coord: LatLng) => {
    if (!state.isOnline || busy) return;
    searchVersion.current++;
    setSearching(false);
    setAddress('');
    setPoint(coord);
    Keyboard.dismiss();
  };
  const findAddress = async () => {
    const query = address.trim();
    if (!query || busy || !state.isOnline) return;
    const version = ++searchVersion.current;
    setSearching(true);
    try {
      const coord = await actions.findHavenAddress(query);
      if (version !== searchVersion.current) return;
      if (!coord) { Alert.alert('Address not found', 'Add a city or postal code, or tap a location on the map.'); return; }
      setPoint(coord);
      map.current?.animateToRegion({ ...coord, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 350);
      Keyboard.dismiss();
    } finally { if (version === searchVersion.current) setSearching(false); }
  };
  const center = previous?.coord ?? state.myLocation ?? group?.meetingPlace?.coord ?? UW_CENTER;
  const save = async () => {
    if (!point || !group || !hazard || busy) return;
    setBusy(true);
    try {
      if (await actions.saveDisasterHaven(group.id, hazard, point, name.trim() || address.trim() || `${HAZARDS[hazard].label} haven`, address)) router.back();
    } finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <MapView ref={map} style={{ flex: 1 }} initialRegion={{ ...center, latitudeDelta: 0.025, longitudeDelta: 0.025 }} showsUserLocation
      onPress={e => pick(e.nativeEvent.coordinate)}
      onLongPress={e => pick(e.nativeEvent.coordinate)}>
      {point && <Marker coordinate={point} title={name || 'Proposed haven'} pinColor="purple" />}
    </MapView>
    <View style={{ padding: 20, paddingBottom: Math.max(insets.bottom, 16), gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{group?.name ?? 'Group unavailable'} · {hazard ? HAZARDS[hazard].label : 'Invalid disaster'}</Text>
      <Text style={{ color: colors.muted }}>{!state.isOnline ? 'Haven locked while offline.' : point ? 'Point selected. Tap elsewhere to adjust, then save.' : 'Tap the map or search an address to choose a haven.'}</Text>
      <TextInput accessibilityLabel="Haven street address" placeholder="Street address, city" placeholderTextColor={colors.muted}
        value={address} editable={!busy && state.isOnline} autoCorrect={false} returnKeyType="search" onSubmitEditing={() => void findAddress()}
        onChangeText={text => { searchVersion.current++; setSearching(false); setAddress(text); setPoint(null); }}
        style={{ color: colors.text, backgroundColor: colors.card, padding: 14, borderRadius: radius }} />
      {!!address.trim() && !point && <BigButton label="Find address on map" icon="search-outline" variant="secondary" loading={searching} disabled={!state.isOnline || busy} onPress={() => void findAddress()} />}
      <TextInput accessibilityLabel="Haven name" placeholder="Name this haven" placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={80} editable={!busy && state.isOnline}
        style={{ color: colors.text, backgroundColor: colors.card, padding: 16, borderRadius: radius }} />
      <BigButton label="Save a meeting point" icon="flag-outline" loading={busy} disabled={!point || !group || !hazard || !state.isOnline || searching} onPress={() => void save()} />
    </View>
  </KeyboardAvoidingView>;
}
