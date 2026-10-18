// [OWNER: MAP/OFFLINE] Main map. Long-press = set meeting place.
// Design: map + bone bottom sheet (meeting point, big distance, one ink action). Color only for danger.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { LocalTile, Marker, Polygon, Polyline, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { BigNumber } from '@/components/BigNumber';
import { MemberPin } from '@/components/MemberPin';
import { OfflineBanner } from '@/components/OfflineBanner';
import { distanceM, formatAge, nearestPlace } from '@/lib/geo';
import { UW_CENTER } from '@/mocks/demo';
import { downloadRegion, localTilePath, ONLINE_TILE_URL, planTiles, TILE_ATTRIBUTION, tileConfigurationError } from '@/services/tiles';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, memberColor, minTarget, radius } from '@/theme';

const STALE_MS = 15 * 60_000;
const WALK_MPS = 1.3;
// Android's Google base map often renders blank in Expo Go (Play services / API key issues).
// With a tile key configured, draw configured raster tiles instead — same provider as the offline cache.
const USE_TILE_BASEMAP = Platform.OS === 'android' && !!ONLINE_TILE_URL;

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

  // What the sheet points at: the active route's target, else the meeting place, else the nearest safe area.
  const target =
    (route && { name: route.targetName, coord: route.to, label: 'Heading to' }) ??
    (meetingPlace && { name: meetingPlace.name, coord: meetingPlace.coord, label: group ? 'Meeting point' : 'My meeting point' }) ??
    (() => {
      const p = myLocation && group ? nearestPlace(myLocation, group.safeAreas) : null;
      return p ? { name: p.name, coord: p.coord, label: 'Nearest safe area' } : null;
    })();
  const meters = route ? route.distanceM : target && myLocation ? distanceM(myLocation, target.coord) : null;
  const minutes = route && !route.isStraightLine ? route.durationS / 60 : meters !== null ? meters / WALK_MPS / 60 : null;
  const walk = minutes !== null ? `${Math.max(1, Math.round(minutes))} min walk` : null;

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

  const primaryLabel = routingLoading
    ? 'Finding walking route…'
    : route
      ? `Route shown${walk ? ` · ${walk}` : ''}`
      : `Start route${walk ? ` · ${walk}` : ''}`;
  const attribution = !isOnline ? (tiles?.attribution ?? TILE_ATTRIBUTION) : TILE_ATTRIBUTION;

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
        mapPadding={{ top: 0, left: 0, right: 0, bottom: 230 }}
        onLongPress={(e) => {
          if (!isOnline) { Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.'); return; }
          void actions.setMeetingPlace(e.nativeEvent.coordinate);
        }}
      >
        {USE_TILE_BASEMAP && isOnline && <UrlTile urlTemplate={ONLINE_TILE_URL} tileSize={256} maximumZ={19} />}
        {!isOnline && tiles && <LocalTile key={tiles.downloadedAt} pathTemplate={localTilePath(tiles)} tileSize={256} />}

        {activeAlert?.areas.map((ring, i) => (
          <Polygon key={`area-${i}`} coordinates={ring} fillColor="rgba(196,22,28,0.12)" strokeColor={colors.danger} strokeWidth={2} />
        ))}

        {route && (
          <Polyline coordinates={route.points} strokeColor={colors.text} strokeWidth={4} lineDashPattern={route.isStraightLine ? [10, 8] : undefined} />
        )}

        {meetingPlace && (
          <Marker coordinate={meetingPlace.coord} title={meetingPlace.name} description={group ? 'Group meeting place' : 'Personal meeting place'} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.meetingMarker} />
          </Marker>
        )}

        {group?.safeAreas.map((p) => (
          <Marker key={p.id} coordinate={p.coord} title={p.name} description={`${p.type.replace('_', ' ')} · tap to route`} anchor={{ x: 0.5, y: 0.5 }} onCalloutPress={() => actions.routeTo(p)}>
            <View style={styles.safeMarker} />
          </Marker>
        ))}

        {members.map((m) => {
          if (!m.location) return null;
          const age = m.locationTs ? Date.now() - m.locationTs : Infinity;
          const color = memberColor(m.uid, group?.memberIds ?? []);
          const help = m.status === 'need_help';
          return (
            <Marker
              // Custom marker views aren't reliably redrawn in place: re-key on what the pin shows so a
              // status/name/color change remounts it immediately.
              key={`${m.uid}-${m.status}-${m.name}-${color}`}
              coordinate={m.location}
              title={help ? `${m.name} needs help` : m.name}
              description={`${help ? 'Needs help' : m.status === 'safe' ? 'Safe' : 'No status'} · ${m.locationTs ? formatAge(age) : 'unknown'}`}
              anchor={{ x: 0.5, y: 0.5 }}
              opacity={age > STALE_MS && !help ? 0.45 : 1}
            >
              <MemberPin name={m.name} color={color} status={m.status} />
            </Marker>
          );
        })}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <OfflineBanner />
        {!isOnline && tiles && <Text style={styles.notice}>Saved map · {formatAge(Date.now() - tiles.downloadedAt)} · downloaded areas only</Text>}
        {!isOnline && <Text style={styles.notice}>Meeting place locked while offline</Text>}
        {routingMessage && <Text style={styles.notice}>{routingMessage}</Text>}
        {DEMO_MODE && <Text style={styles.demo}>Demo mode · no Firebase config</Text>}
      </SafeAreaView>

      <View style={styles.sheet}>
        {target ? (
          <View style={styles.sheetHead}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>{target.label}</Text>
              <Text style={styles.targetName} numberOfLines={2}>{target.name}</Text>
            </View>
            <BigNumber meters={meters} size={52} />
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            <Text style={styles.label}>No meeting point yet</Text>
            <Text style={styles.targetName}>Long-press the map to set one</Text>
          </View>
        )}

        {route && (
          <Text style={styles.fine}>
            {route.isStraightLine ? 'Straight-line direction' : 'Walking route'}
            {!route.isStraightLine && (routeIsCached || !isOnline) ? ` · saved ${formatAge(Math.max(0, Date.now() - route.fetchedAt))}` : ''}
            {' · does not account for hazards · '}
            <Text style={styles.link} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>© OpenStreetMap</Text>
            {' · '}
            <Text style={styles.link} onPress={() => Linking.openURL('https://routing.openstreetmap.de/about.html')}>FOSSGIS</Text>
            {' · '}
            <Text style={styles.link} onPress={() => Linking.openURL(`https://www.openstreetmap.org/fixthemap?mlat=${route.to.latitude}&mlon=${route.to.longitude}#map=17/${route.to.latitude}/${route.to.longitude}`)}>Fix the map</Text>
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          disabled={routingLoading || !target}
          onPress={() => void actions.routeToBestTarget()}
          style={({ pressed }) => [styles.primary, { opacity: !target ? 0.4 : pressed || routingLoading ? 0.75 : 1 }]}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>

        <View style={styles.tools}>
          <ActionButton icon="compass-outline" label="Compass" onPress={() => router.push('/compass')} />
          <ActionButton icon="cloud-download-outline" label={tileProgress ?? (tiles ? 'Map saved' : 'Save map')} onPress={onDownloadTiles} />
          <ActionButton icon="warning-outline" label="Simulate" color={colors.danger} onPress={() => router.push('/simulate')} />
        </View>

        {(USE_TILE_BASEMAP || (!isOnline && tiles)) && !!attribution && (
          <Text
            style={[styles.fine, styles.link]}
            onPress={() => { const url = tiles?.attributionUrl ?? process.env.EXPO_PUBLIC_TILE_ATTRIBUTION_URL; if (url) void Linking.openURL(url); }}
          >
            {attribution}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.card },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  notice: { backgroundColor: colors.bg, color: colors.text, fontSize: 15, fontWeight: '600', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: colors.text },
  demo: { alignSelf: 'flex-start', margin: 12, backgroundColor: colors.bg, color: colors.text, borderWidth: 1, borderColor: colors.text, fontSize: 13, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3 },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopWidth: 1, borderColor: colors.text, padding: 20, paddingBottom: 16, gap: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  label: { fontSize: 15, fontWeight: '600', color: colors.muted },
  targetName: { fontSize: 24, lineHeight: 27, fontWeight: '700', color: colors.text },
  fine: { fontSize: 12, lineHeight: 16, color: colors.muted },
  link: { textDecorationLine: 'underline' },
  primary: { minHeight: minTarget, backgroundColor: colors.primary, borderRadius: radius, justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: colors.onPrimary, fontSize: 19, fontWeight: '700' },
  tools: { flexDirection: 'row', gap: 8 },

  meetingMarker: { width: 22, height: 22, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.text, transform: [{ rotate: '45deg' }] },
  safeMarker: { width: 14, height: 14, backgroundColor: colors.safe, borderWidth: 1, borderColor: colors.bg },
});
