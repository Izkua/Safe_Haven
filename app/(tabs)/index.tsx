// [OWNER: MAP/OFFLINE] Main map. Long-press = set meeting place.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { LocalTile, Marker, Polygon, Polyline, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { formatAge, formatDistance } from '@/lib/geo';
import { UW_CENTER } from '@/mocks/demo';
import { makeSimulatedAlert } from '@/services/alerts';
import { downloadRegion, estimateTileCount, ONLINE_TILE_URL, TILE_ATTRIBUTION, TILE_PATH_TEMPLATE } from '@/services/tiles';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, statusColor } from '@/theme';

const STALE_MS = 15 * 60_000;
// Android's Google base map often renders blank in Expo Go (Play services / API key issues).
// With a tile key configured, draw MapTiler tiles instead — same provider as the offline cache.
const USE_TILE_BASEMAP = Platform.OS === 'android' && !!ONLINE_TILE_URL;

export default function MapScreen() {
  const { state, actions } = useApp();
  const { group, members, route, myLocation, isOnline, tiles, activeAlert, routingLoading, routingMessage, routeIsCached } = state;
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
        mapType={USE_TILE_BASEMAP ? 'none' : 'standard'}
        initialRegion={{ ...center, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        onLongPress={(e) => actions.setMeetingPlace(e.nativeEvent.coordinate)}
      >
        {USE_TILE_BASEMAP && isOnline && <UrlTile urlTemplate={ONLINE_TILE_URL} tileSize={256} maximumZ={19} />}
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

      {(USE_TILE_BASEMAP || (!isOnline && tiles)) && <Text style={styles.attribution}>{TILE_ATTRIBUTION}</Text>}

      <View style={styles.actions}>
        <ActionButton icon="navigate" label={routingLoading ? "Routing…" : "Go"} onPress={() => { if (!routingLoading) void actions.routeToBestTarget(); }} />
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
  attribution: { position: 'absolute', bottom: 84, right: 12, fontSize: 10, color: '#333', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  actions: { position: 'absolute', bottom: 16, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
