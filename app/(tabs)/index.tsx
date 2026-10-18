// [OWNER: MAP/OFFLINE] Main map. Long-press = set meeting place.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { LocalTile, Marker, Polygon, Polyline, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { MemberPin } from '@/components/MemberPin';
import { OfflineBanner } from '@/components/OfflineBanner';
import { formatAge, formatDistance } from '@/lib/geo';
import { UW_CENTER } from '@/mocks/demo';
import { downloadRegion, planTiles, tileConfigurationError, localTilePath, ONLINE_TILE_URL, TILE_ATTRIBUTION } from '@/services/tiles';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, memberColor } from '@/theme';

const STALE_MS = 15 * 60_000;
// Android's Google base map often renders blank in Expo Go (Play services / API key issues).
// With a tile key configured, draw configured raster tiles instead — same provider as the offline cache.
const USE_TILE_BASEMAP = Platform.OS === 'android' && !!ONLINE_TILE_URL;

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
  const { group, personalMeetingPlace, members, route, myLocation, isOnline, tiles, activeAlert, routingLoading, routingMessage, routeIsCached } = state;
  const mapRef = useRef<MapView>(null);
  const downloadBusy = useRef(false);
  const [tileProgress, setTileProgress] = useState<string | null>(null);

  // Open the alert screen whenever a new alert arrives.
  useEffect(() => {
    if (activeAlert) router.push('/alert');
  }, [activeAlert?.id]);

  const meetingPlace = group ? group.meetingPlace : personalMeetingPlace;
  const center = myLocation ?? meetingPlace?.coord ?? UW_CENTER;

  const onDownloadTiles = () => {
    if (downloadBusy.current) return;
    if (!isOnline) { Alert.alert('No connection', 'Connect to the internet before saving a map.'); return; }
    const configError = tileConfigurationError();
    if (configError) { Alert.alert('Offline map setup', configError); return; }
    const meeting = meetingPlace?.coord;
    let n: number;
    try { n = planTiles(meeting ? [center, meeting] : [center]).length; }
    catch (e) { Alert.alert('Cannot save area', (e as Error).message); return; }
    Alert.alert('Download offline map?', `${n} tiles around you${meeting ? ' and the meeting place' : ''}, about ${Math.ceil(n * 30 / 1024)} MB (estimate). Covers 1.5 km around each point at zoom 12–16.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Download', onPress: async () => {
        if (downloadBusy.current) return;
        downloadBusy.current = true;
        setTileProgress('Starting…');
        try {
          const region = await downloadRegion(center, (d, t) => setTileProgress(`${d}/${t}`), meeting);
          actions.setTiles(region);
          Alert.alert('Map saved', 'Use Compass to navigate without signal. Only the downloaded areas and zoom levels are available offline.');
        } catch (e) {
          Alert.alert('Map not fully saved', e instanceof Error ? e.message : 'Please retry. Completed tiles will be reused.');
        } finally { downloadBusy.current = false; setTileProgress(null); }
      } },
    ]);
  };

  return (
    <View style={styles.fill}>
      <MapView
        ref={mapRef}
        style={styles.fill}
        minZoomLevel={!isOnline && tiles ? tiles.minZoom : undefined}
        maxZoomLevel={!isOnline && tiles ? tiles.maxZoom : undefined}
        showsUserLocation
        showsCompass
        mapType={USE_TILE_BASEMAP ? 'none' : 'standard'}
        initialRegion={{ ...center, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        onLongPress={(e) => {
          if (!isOnline) { Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.'); return; }
          void actions.setMeetingPlace(e.nativeEvent.coordinate);
        }}
      >
        {USE_TILE_BASEMAP && isOnline && <UrlTile urlTemplate={ONLINE_TILE_URL} tileSize={256} maximumZ={19} />}
        {!isOnline && tiles && <LocalTile key={tiles.downloadedAt} pathTemplate={localTilePath(tiles)} tileSize={256} />}

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
        {!isOnline && tiles && <Text style={styles.demo}>Saved map · {formatAge(Date.now() - tiles.downloadedAt)} · downloaded areas only</Text>}
        {DEMO_MODE && <Text style={styles.demo}>DEMO MODE · no Firebase config</Text>}
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

      {(USE_TILE_BASEMAP || (!isOnline && tiles)) && <Text style={styles.attribution} onPress={() => { const url = tiles?.attributionUrl ?? process.env.EXPO_PUBLIC_TILE_ATTRIBUTION_URL; if (url) void Linking.openURL(url); }}>{!isOnline ? (tiles?.attribution ?? TILE_ATTRIBUTION) : TILE_ATTRIBUTION}</Text>}

      <View style={styles.actions}>
        <ActionButton icon="navigate" label={routingLoading ? "Routing…" : "Go"} onPress={() => { if (!routingLoading) void actions.routeToBestTarget(); }} />
        <ActionButton icon="compass" label="Compass" onPress={() => router.push('/compass')} />
        <ActionButton icon="cloud-download" label={tileProgress ?? (tiles ? 'Saved' : 'Offline map')} onPress={onDownloadTiles} />
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
  actions: { position: 'absolute', bottom: 16, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
