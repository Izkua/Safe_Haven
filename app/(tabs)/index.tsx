// [OWNER: MAP/OFFLINE] Main map. Long-press = set meeting place.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import MapView, { LocalTile, Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { formatAge, formatDistance } from '@/lib/geo';
import { UW_CENTER } from '@/mocks/demo';
import { makeSimulatedAlert } from '@/services/alerts';
import { downloadRegion, estimateTileCount, TILE_PATH_TEMPLATE } from '@/services/tiles';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, statusColor } from '@/theme';

const STALE_MS = 15 * 60_000;

export default function MapScreen() {
  const { state, actions } = useApp();
  const { group, members, route, myLocation, isOnline, tiles, activeAlert } = state;
  const mapRef = useRef<MapView>(null);
  const [tileProgress, setTileProgress] = useState<string | null>(null);

  // Open the alert screen whenever a new alert arrives.
  useEffect(() => {
    if (activeAlert) router.push('/alert');
  }, [activeAlert?.id]);

  const center = myLocation ?? group?.meetingPlace?.coord ?? UW_CENTER;

  const onDownloadTiles = async () => {
    const n = estimateTileCount(center);
    Alert.alert('Download offline map?', `About ${n} tiles (~${Math.round((n * 15) / 1024)} MB) around you.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Download',
        onPress: async () => {
          const region = await downloadRegion(center, (d, t) => setTileProgress(`${d}/${t}`));
          setTileProgress(null);
          if (region) actions.setTiles(region);
        },
      },
    ]);
  };

  return (
    <View style={styles.fill}>
      <MapView
        ref={mapRef}
        style={styles.fill}
        showsUserLocation
        showsCompass
        initialRegion={{ ...center, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        onLongPress={(e) => actions.setMeetingPlace(e.nativeEvent.coordinate)}
      >
        {!isOnline && tiles && <LocalTile pathTemplate={TILE_PATH_TEMPLATE} tileSize={256} />}

        {activeAlert?.areas.map((ring, i) => (
          <Polygon key={`area-${i}`} coordinates={ring} fillColor="rgba(235,87,87,0.15)" strokeColor={colors.danger} />
        ))}

        {route && <Polyline coordinates={route.points} strokeColor={colors.primary} strokeWidth={5} lineDashPattern={route.isStraightLine ? [8, 6] : undefined} />}

        {group?.meetingPlace && (
          <Marker coordinate={group.meetingPlace.coord} title={group.meetingPlace.name} description="Meeting place" pinColor={colors.meeting} />
        )}

        {group?.safeAreas.map((p) => (
          <Marker key={p.id} coordinate={p.coord} title={p.name} description={p.type} pinColor={colors.shelter} onCalloutPress={() => actions.routeTo(p)} />
        ))}

        {members.map((m) => {
          if (!m.location) return null;
          const age = m.locationTs ? Date.now() - m.locationTs : Infinity;
          return (
            <Marker
              key={m.uid}
              coordinate={m.location}
              title={m.name}
              description={`${m.status.replace('_', ' ')} · ${m.locationTs ? formatAge(age) : 'unknown'}`}
              pinColor={statusColor[m.status]}
              opacity={age > STALE_MS ? 0.45 : 1}
            />
          );
        })}
      </MapView>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <OfflineBanner />
        {DEMO_MODE && <Text style={styles.demo}>DEMO MODE · no Firebase config</Text>}
        {route && (
          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>→ {route.targetName}</Text>
            <Text style={styles.routeSub}>
              {formatDistance(route.distanceM)} · ~{Math.round(route.durationS / 60)} min walk
              {route.isStraightLine ? ' · straight line' : ''}
            </Text>
          </View>
        )}
      </SafeAreaView>

      <View style={styles.actions}>
        <ActionButton icon="navigate" label="Go" onPress={actions.routeToBestTarget} />
        <ActionButton icon="compass" label="Compass" onPress={() => router.push('/compass')} />
        <ActionButton icon="cloud-download" label={tileProgress ?? (tiles ? 'Saved' : 'Offline map')} onPress={onDownloadTiles} />
        <ActionButton icon="warning" label="Simulate" color={colors.danger} onPress={() => actions.triggerAlert(makeSimulatedAlert(center))} />
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
  actions: { position: 'absolute', bottom: 16, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
