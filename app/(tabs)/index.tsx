// [OWNER: MAP/OFFLINE] Main map. Hold 1 s, slide to a group, let go = set that group's meeting place.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { GroupFilter } from '@/components/GroupFilter';
import { HoldGroupPicker, type PickOption } from '@/components/HoldGroupPicker';
import { MemberPin } from '@/components/MemberPin';
import { OfflineBanner } from '@/components/OfflineBanner';
import { formatAge, formatDistance } from '@/lib/geo';
import { allMemberIds, visibleMembers } from '@/lib/groups';
import { UW_CENTER } from '@/mocks/demo';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, memberColor } from '@/theme';
import type { LatLng } from '@/types';

const STALE_MS = 15 * 60_000;
/** The route card's ⓘ: safety disclaimer plus the credits/links that used to crowd the card. */
function showRouteInfo(to: { latitude: number; longitude: number }) {
  Alert.alert(
    'About this route',
    'Routes do not account for disaster hazards or guarantee safe passage. Always follow instructions from local officials.\n\nWalking routes by FOSSGIS / OSRM using © OpenStreetMap contributors.',
    [
      { text: 'Routing service', onPress: () => Linking.openURL('https://routing.openstreetmap.de/about.html') },
      { text: 'Fix the map', onPress: () => Linking.openURL(`https://www.openstreetmap.org/fixthemap?mlat=${to.latitude}&mlon=${to.longitude}#map=17/${to.latitude}/${to.longitude}`) },
      { text: 'OK', style: 'cancel' },
    ],
  );
}

export default function MapScreen() {
  const { state, actions } = useApp();
  const { group, groups, visibleGroupIds, personalMeetingPlace, members, route, myLocation, isOnline, activeAlert, routingLoading, routingMessage, routeIsCached } = state;
  const mapRef = useRef<MapView>(null);
  // Hold-to-drop meeting place: map frozen while choosing, preview pin, then a naming sheet.
  const [mapLocked, setMapLocked] = useState(false);
  const [pendingPin, setPendingPin] = useState<LatLng | null>(null);
  const [naming, setNaming] = useState<{ coord: LatLng; option: PickOption; name: string } | null>(null);
  const pickOptions: PickOption[] = useMemo(
    () => (groups.length ? groups.map((g) => ({ id: g.id, label: g.id === group?.id ? `${g.name} (current)` : g.name })) : [{ id: null, label: 'Just me' }]),
    [groups, group?.id],
  );
  const saveNamedPin = () => {
    if (!naming) return;
    void actions.setMeetingPlace(naming.coord, naming.name.trim() || 'Meeting place', naming.option.id ?? undefined);
    setNaming(null);
  };

  // Open the alert screen whenever a new alert arrives.
  useEffect(() => {
    if (activeAlert) router.push('/alert');
  }, [activeAlert?.id]);

  const meetingPlace = group ? group.meetingPlace : personalMeetingPlace;
  // Members of the checked groups, one pin per person even if they share several groups with me.
  const shownMembers = useMemo(() => visibleMembers(members, groups, visibleGroupIds), [members, groups, visibleGroupIds]);
  // Color by position across ALL my groups (current group first) so a person keeps one color.
  const colorOrder = useMemo(() => allMemberIds(group ? [group, ...groups] : groups), [group, groups]);
  const center = myLocation ?? meetingPlace?.coord ?? UW_CENTER;


  return (
    <View style={styles.fill}>
      <HoldGroupPicker
        options={pickOptions}
        getCoordinate={async (pt) => (mapRef.current ? mapRef.current.coordinateForPoint(pt) : null)}
        canStart={() => {
          if (isOnline) return true;
          Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.');
          return false;
        }}
        onLockMap={setMapLocked}
        onPendingChange={setPendingPin}
        onPick={(coord, option) => setNaming({ coord, option, name: 'Meeting place' })}
      >
      <MapView
        key="apple-map"
        ref={mapRef}
        style={styles.fill}
        scrollEnabled={!mapLocked}
        zoomEnabled={!mapLocked}
        rotateEnabled={!mapLocked}
        pitchEnabled={!mapLocked}
        showsUserLocation
        showsCompass
        mapType="standard"
        initialRegion={{ ...center, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
      >
        {activeAlert?.areas.map((ring, i) => (
          <Polygon key={`area-${i}`} coordinates={ring} fillColor="rgba(235,87,87,0.15)" strokeColor={colors.danger} />
        ))}

        {route && <Polyline coordinates={route.points} strokeColor={colors.primary} strokeWidth={5} lineDashPattern={route.isStraightLine ? [8, 6] : undefined} />}

        {/* Each group has its own meeting place: show the current group's plus every checked group's. */}
        {groups.length
          ? groups
              .filter((g) => g.meetingPlace && (g.id === group?.id || visibleGroupIds.includes(g.id)))
              .map((g) => (
                <Marker
                  key={`meet-${g.id}`}
                  coordinate={g.meetingPlace!.coord}
                  title={g.meetingPlace!.name}
                  description={`${g.name} meeting place${g.meetingPlace!.address ? ` · ${g.meetingPlace!.address}` : ''}`}
                  pinColor={colors.meeting}
                  opacity={g.id === group?.id ? 1 : 0.7}
                />
              ))
          : meetingPlace && <Marker coordinate={meetingPlace.coord} title={meetingPlace.name} description="Personal meeting place" pinColor={colors.meeting} />}

        {pendingPin && <Marker coordinate={pendingPin} pinColor={colors.warn} />}

        {group?.safeAreas.map((p) => (
          <Marker key={p.id} coordinate={p.coord} title={p.name} description={p.type} pinColor={colors.shelter} onCalloutPress={() => actions.routeTo(p)} />
        ))}

        {shownMembers.map((m) => {
          if (!m.location) return null;
          const age = m.locationTs ? Date.now() - m.locationTs : Infinity;
          const color = memberColor(m.uid, colorOrder);
          return (
            <Marker
              // Custom marker views aren't reliably redrawn in place: re-key on what the pin shows so a
              // status/name/color change remounts it immediately.
              key={`${m.uid}-${m.status}-${m.name}-${color}`}
              coordinate={m.location}
              title={m.name}
              description={`${m.status.replace('_', ' ')} · ${m.locationTs ? formatAge(age) : 'unknown'}`}
              anchor={{ x: 0.5, y: 0.5 }}
              opacity={age > STALE_MS ? 0.45 : 1}
            >
              <MemberPin name={m.name} color={color} status={m.status} />
            </Marker>
          );
        })}
      </MapView>
      </HoldGroupPicker>

      <Modal visible={!!naming} transparent animationType="fade" onRequestClose={() => setNaming(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.routeTitle}>Name this meeting place</Text>
            <Text style={styles.routeSub}>For {naming?.option.label.replace(' (current)', '')}</Text>
            <TextInput
              style={styles.modalInput}
              value={naming?.name ?? ''}
              onChangeText={(name) => setNaming((n) => (n ? { ...n, name } : n))}
              autoFocus
              selectTextOnFocus
              placeholder="e.g. Front lawn"
              placeholderTextColor={colors.muted}
              onSubmitEditing={saveNamedPin}
              returnKeyType="done"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.bg }]} onPress={() => setNaming(null)}><Text style={styles.modalBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.meeting }]} onPress={saveNamedPin}><Text style={styles.modalBtnText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <OfflineBanner />
        {!isOnline && <Text style={styles.demo}>Meeting place locked while offline</Text>}
        {!isOnline && <Text style={styles.demo}>Apple Maps: cached areas only · coverage may be unavailable</Text>}
        {DEMO_MODE && <Text style={styles.demo}>DEMO MODE · no Firebase config</Text>}
        <GroupFilter groups={groups} visibleIds={visibleGroupIds} onToggle={actions.toggleGroupVisible} />
        {route && (
          <View style={styles.routeCard}>
            <View style={styles.routeHeader}>
              <Text style={styles.routeTitle} numberOfLines={1}>→ {route.targetName}</Text>
              <Pressable onPress={() => showRouteInfo(route.to)} hitSlop={12} accessibilityRole="button" accessibilityLabel="About this route">
                <Ionicons name="information-circle-outline" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.routeSub}>
              {formatDistance(route.distanceM)}
              {route.isStraightLine ? ' · Straight-line direction' : ` · ~${Math.max(1, Math.round(route.durationS / 60))} min walk`}
              {!route.isStraightLine && (routeIsCached || !isOnline) ? ` · Saved ${formatAge(Math.max(0, Date.now() - route.fetchedAt))}` : ''}
            </Text>
            {/* OpenStreetMap's license requires visible credit wherever its data is shown. */}
            <Text style={styles.routeCredit} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>© OpenStreetMap · FOSSGIS</Text>
          </View>
        )}
        {routingLoading && <Text style={styles.demo}>Finding walking route…</Text>}
        {routingMessage && <Text style={styles.demo}>{routingMessage}</Text>}
      </SafeAreaView>

      <View style={styles.actions}>
        <ActionButton icon="navigate" label={routingLoading ? "Routing…" : "Go"} onPress={() => { if (!routingLoading) void actions.routeToBestTarget(); }} />
        <ActionButton icon="compass" label="Compass" onPress={() => router.push('/compass')} />
        <ActionButton icon="cloud-download" label="Offline Mode" onPress={() => router.push('/offline-readiness')} />
        <ActionButton icon="warning" label="Simulate" color={colors.danger} onPress={() => router.push('/simulate')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, gap: 8 },
  demo: { alignSelf: 'center', backgroundColor: colors.warn, color: '#000', fontWeight: '600', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontSize: 12 },
  routeCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  routeSub: { color: colors.muted, marginTop: 2 },
  routeCredit: { color: colors.muted, fontSize: 10, opacity: 0.7, marginTop: 4 },
  attribution: { position: 'absolute', bottom: 84, right: 12, fontSize: 10, color: '#333', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 },
  modalInput: { backgroundColor: colors.bg, color: colors.text, borderRadius: 10, padding: 12, fontSize: 16 },
  modalBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700' },
  actions: { position: 'absolute', bottom: 16, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
