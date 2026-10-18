// [OWNER: MAP/OFFLINE] Main map. Long-press = set meeting place.
// Design: map + rounded bottom sheet: where you are going, then real labelled buttons.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import MapView, { LocalTile, Marker, Polygon, Polyline, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { MemberPin } from '@/components/MemberPin';
import { OfflineBanner } from '@/components/OfflineBanner';
import { distanceM, formatAge, formatDistance, nearestPlace } from '@/lib/geo';
import { UW_CENTER } from '@/mocks/demo';
import { downloadRegion, localTilePath, ONLINE_TILE_URL, planTiles, TILE_ATTRIBUTION, tileConfigurationError } from '@/services/tiles';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, mapOverlayColors, memberColor, radius } from '@/theme';

const STALE_MS = 15 * 60_000;
const WALK_MPS = 1.3;
// Android's Google base map often renders blank in Expo Go (Play services / API key issues).
// With a tile key configured, draw configured raster tiles instead — same provider as the offline cache.
const USE_TILE_BASEMAP = Platform.OS === 'android' && !!ONLINE_TILE_URL;

export default function MapScreen() {
  const { state, actions } = useApp();
  const overlay = mapOverlayColors(useColorScheme()); // map overlays need plain strings, not dynamic colors
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

  const busyLabel = tileProgress ? `Saving map ${tileProgress}` : null;
  const goLabel = routingLoading
    ? "Finding walking route…"
    : !target
      ? "Set a meeting point first"
      : route
        ? `Update route to ${target.name}`
        : target.label === "Nearest safe area"
          ? "Go to nearest safe area"
          : "Go to meeting point";
  const summary = target
    ? [target.label, meters !== null ? formatDistance(meters) : null, walk].filter(Boolean).join(" · ")
    : "Long-press the map to drop a meeting point.";
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
        mapPadding={{ top: 0, left: 0, right: 0, bottom: 290 }}
        onLongPress={(e) => {
          if (!isOnline) { Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.'); return; }
          void actions.setMeetingPlace(e.nativeEvent.coordinate);
        }}
      >
        {USE_TILE_BASEMAP && isOnline && <UrlTile urlTemplate={ONLINE_TILE_URL} tileSize={256} maximumZ={19} />}
        {!isOnline && tiles && <LocalTile key={tiles.downloadedAt} pathTemplate={localTilePath(tiles)} tileSize={256} />}

        {activeAlert?.areas.map((ring, i) => (
          <Polygon key={`area-${i}`} coordinates={ring} fillColor="rgba(179,38,30,0.14)" strokeColor={overlay.danger} strokeWidth={2} />
        ))}

        {route && (
          <Polyline coordinates={route.points} strokeColor={overlay.route} strokeWidth={4} lineDashPattern={route.isStraightLine ? [10, 8] : undefined} />
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
        {!isOnline && tiles && <Text style={styles.notice}>Using the map saved {formatAge(Date.now() - tiles.downloadedAt)}. Meeting point can’t change offline.</Text>}
        {!isOnline && !tiles && <Text style={styles.notice}>Meeting point can’t change while offline.</Text>}
        {routingMessage && <Text style={styles.notice}>{routingMessage}</Text>}
        {DEMO_MODE && <Text style={styles.demo}>Demo mode</Text>}
      </SafeAreaView>

      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.targetName} numberOfLines={2} accessibilityRole="header">
            {target ? target.name : "No meeting point yet"}
          </Text>
          <Text style={styles.summary}>{summary}</Text>
        </View>

        <BigButton
          label={goLabel}
          icon="navigate"
          loading={routingLoading}
          disabled={!target}
          onPress={() => void actions.routeToBestTarget()}
        />
        <View style={styles.row}>
          <BigButton label="Compass" icon="compass-outline" variant="secondary" style={styles.half} onPress={() => router.push('/compass')} />
          <BigButton
            label={busyLabel ?? (tiles ? 'Map saved' : 'Save map')}
            icon={tiles ? 'checkmark-circle-outline' : 'cloud-download-outline'}
            variant="secondary"
            style={styles.half}
            accessibilityHint="Downloads the map around you for use without signal"
            onPress={onDownloadTiles}
          />
        </View>
        <BigButton label="Practice a disaster" icon="warning-outline" variant="plain" tone="danger" onPress={() => router.push('/simulate')} />

        {(route || USE_TILE_BASEMAP || (!isOnline && tiles)) && (
          <Text style={styles.fine}>
            {route ? (route.isStraightLine ? 'Straight-line direction. ' : 'Walking route. ') : ''}
            {route && !route.isStraightLine && (routeIsCached || !isOnline) ? `Saved ${formatAge(Math.max(0, Date.now() - route.fetchedAt))}. ` : ''}
            {route ? 'Routes don’t avoid hazards. ' : ''}
            <Text style={styles.link} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>© OpenStreetMap</Text>
            {route ? <>{' · '}<Text style={styles.link} onPress={() => Linking.openURL('https://routing.openstreetmap.de/about.html')}>FOSSGIS</Text></> : null}
            {(USE_TILE_BASEMAP || (!isOnline && tiles)) && !!attribution ? <>{' · '}<Text style={styles.link} onPress={() => { const url = tiles?.attributionUrl ?? process.env.EXPO_PUBLIC_TILE_ATTRIBUTION_URL; if (url) void Linking.openURL(url); }}>{attribution}</Text></> : null}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, gap: 8 },
  notice: { backgroundColor: colors.card, color: colors.text, fontSize: 15, lineHeight: 20, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius, overflow: 'hidden' },
  demo: { alignSelf: 'flex-start', backgroundColor: colors.card, color: colors.muted, fontSize: 13, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, gap: 10 },
  sheetHead: { gap: 2, paddingHorizontal: 4, marginBottom: 4 },
  targetName: { fontSize: 20, lineHeight: 25, fontWeight: '600', color: colors.text },
  summary: { fontSize: 15, lineHeight: 20, color: colors.muted },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  fine: { fontSize: 12, lineHeight: 16, color: colors.muted, textAlign: 'center' },
  link: { textDecorationLine: 'underline' },

  meetingMarker: { width: 22, height: 22, borderRadius: 4, backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.text, transform: [{ rotate: '45deg' }] },
  safeMarker: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.safe, borderWidth: 2, borderColor: colors.bg },
});
