// [OWNER: MAP/OFFLINE] Main map. Long-press = set meeting place.
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { MemberPin } from '@/components/MemberPin';
import { OfflineBanner } from '@/components/OfflineBanner';
import { formatAge, formatDistance } from '@/lib/geo';
import { UW_CENTER } from '@/mocks/demo';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, memberColor } from '@/theme';

const STALE_MS = 15 * 60_000;
export default function MapScreen() {
  const { state, actions } = useApp();
  const { group, personalMeetingPlace, members, route, myLocation, isOnline, activeAlert, routingLoading, routingMessage, routeIsCached } = state;
  const mapRef = useRef<MapView>(null);
  // Open the alert screen whenever a new alert arrives.
  useEffect(() => {
    if (activeAlert) router.push('/alert');
  }, [activeAlert?.id]);

  const meetingPlace = group ? group.meetingPlace : personalMeetingPlace;
  const center = myLocation ?? meetingPlace?.coord ?? UW_CENTER;


  return (
    <View style={styles.fill}>
      <MapView
        key="apple-map"
        ref={mapRef}
        style={styles.fill}
        showsUserLocation
        showsCompass
        mapType="standard"
        initialRegion={{ ...center, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        onLongPress={(e) => {
          if (!isOnline) { Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.'); return; }
          void actions.setMeetingPlace(e.nativeEvent.coordinate);
        }}
      >
        {activeAlert?.areas.map((ring, i) => (
          <Polygon key={`area-${i}`} coordinates={ring} fillColor="rgba(235,87,87,0.15)" strokeColor={colors.danger} />
        ))}

        {route && <Polyline coordinates={route.points} strokeColor={colors.primary} strokeWidth={5} lineDashPattern={route.isStraightLine ? [8, 6] : undefined} />}

        {meetingPlace && (
          <Marker coordinate={meetingPlace.coord} title={meetingPlace.name} description={group ? "Group meeting place" : "Personal meeting place"} pinColor={colors.meeting} />
        )}

        {group?.safeAreas.map((p) => (
          <Marker key={p.id} coordinate={p.coord} title={p.name} description={p.type} pinColor={colors.shelter} onCalloutPress={() => actions.routeTo(p)} />
        ))}

        {members.map((m) => {
          if (!m.location) return null;
          const age = m.locationTs ? Date.now() - m.locationTs : Infinity;
          const color = memberColor(m.uid, group?.memberIds ?? []);
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

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <OfflineBanner />
        {!isOnline && <Text style={styles.demo}>Meeting place locked while offline</Text>}
        {!isOnline && <Text style={styles.demo}>Apple Maps: cached areas only · coverage may be unavailable</Text>}
        {DEMO_MODE && <Text style={styles.demo}>DEMO MODE · no Firebase config</Text>}
        {route && (
          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>→ {route.targetName}</Text>
            <Text style={styles.routeSub}>
              {formatDistance(route.distanceM)}
              {route.isStraightLine ? ' · Straight-line direction' : ` · ~${Math.max(1, Math.round(route.durationS / 60))} min walk`}
              {!route.isStraightLine && (routeIsCached || !isOnline) ? ` · Saved ${formatAge(Math.max(0, Date.now() - route.fetchedAt))}` : ''}
            </Text>
            <Text style={styles.routeSub}>Routes do not account for disaster hazards or guarantee safe passage.</Text>
            <Text style={styles.routeSub} onPress={() => Linking.openURL('https://routing.openstreetmap.de/about.html')}>Walking routes: FOSSGIS / OSRM</Text>
            <Text style={styles.routeSub} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>© OpenStreetMap contributors</Text>
            <Text style={styles.routeSub} onPress={() => Linking.openURL(`https://www.openstreetmap.org/fixthemap?mlat=${route.to.latitude}&mlon=${route.to.longitude}#map=17/${route.to.latitude}/${route.to.longitude}`)}>Fix the map</Text>
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
  routeTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  routeSub: { color: colors.muted, marginTop: 2 },
  attribution: { position: 'absolute', bottom: 84, right: 12, fontSize: 10, color: '#333', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  actions: { position: 'absolute', bottom: 16, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
