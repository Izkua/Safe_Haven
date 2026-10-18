// [OWNER: MAP/OFFLINE] Main map. Long-press = set meeting place.
// Design: map + bone bottom sheet (meeting point, big distance, one ink action). Color only for danger.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { LocalTile, Marker, Polygon, Polyline, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { BigNumber } from '@/components/BigNumber';
import { OfflineBanner } from '@/components/OfflineBanner';
import { distanceM, formatAge, nearestPlace } from '@/lib/geo';
import { UW_CENTER } from '@/mocks/demo';
import { makeSimulatedAlert } from '@/services/alerts';
import { downloadRegion, estimateTileCount, ONLINE_TILE_URL, TILE_ATTRIBUTION, TILE_PATH_TEMPLATE } from '@/services/tiles';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, minTarget, radius, statusColor } from '@/theme';
import type { Member } from '@/types';

const STALE_MS = 15 * 60_000;
const WALK_MPS = 1.3;
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

  // What the sheet points at: the active route's target, else the meeting place, else the nearest safe area.
  const target =
    (route && { name: route.targetName, coord: route.to, label: 'Heading to' }) ??
    (group?.meetingPlace && { name: group.meetingPlace.name, coord: group.meetingPlace.coord, label: 'Meeting point' }) ??
    (() => {
      const p = myLocation && group ? nearestPlace(myLocation, group.safeAreas) : null;
      return p ? { name: p.name, coord: p.coord, label: 'Nearest safe area' } : null;
    })();
  const meters = route ? route.distanceM : target && myLocation ? distanceM(myLocation, target.coord) : null;
  const minutes = route && !route.isStraightLine ? route.durationS / 60 : meters !== null ? meters / WALK_MPS / 60 : null;
  const walk = minutes !== null ? `${Math.max(1, Math.round(minutes))} min walk` : null;

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

  const primaryLabel = routingLoading
    ? 'Finding walking route…'
    : route
      ? `Route shown${walk ? ` · ${walk}` : ''}`
      : `Start route${walk ? ` · ${walk}` : ''}`;

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
        mapPadding={{ top: 0, left: 0, right: 0, bottom: 230 }}
      >
        {USE_TILE_BASEMAP && isOnline && <UrlTile urlTemplate={ONLINE_TILE_URL} tileSize={256} maximumZ={19} />}
        {!isOnline && tiles && <LocalTile pathTemplate={TILE_PATH_TEMPLATE} tileSize={256} />}

        {activeAlert?.areas.map((ring, i) => (
          <Polygon key={`area-${i}`} coordinates={ring} fillColor="rgba(196,22,28,0.12)" strokeColor={colors.danger} strokeWidth={2} />
        ))}

        {route && (
          <Polyline coordinates={route.points} strokeColor={colors.text} strokeWidth={4} lineDashPattern={route.isStraightLine ? [10, 8] : undefined} />
        )}

        {group?.meetingPlace && (
          <Marker coordinate={group.meetingPlace.coord} title={group.meetingPlace.name} description="Meeting place" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.meetingMarker} />
          </Marker>
        )}

        {group?.safeAreas.map((p) => (
          <Marker key={p.id} coordinate={p.coord} title={p.name} description={`${p.type.replace('_', ' ')} · tap to route`} anchor={{ x: 0.5, y: 0.5 }} onCalloutPress={() => actions.routeTo(p)}>
            <View style={styles.safeMarker} />
          </Marker>
        ))}

        {members.map((m) => (m.location ? <MemberMarker key={m.uid} m={m} /> : null))}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <OfflineBanner />
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
          <ActionButton icon="warning-outline" label="Simulate" color={colors.danger} onPress={() => actions.triggerAlert(makeSimulatedAlert(center))} />
        </View>

        {(USE_TILE_BASEMAP || (!isOnline && tiles)) && <Text style={styles.fine}>{TILE_ATTRIBUTION}</Text>}
      </View>
    </View>
  );
}

function MemberMarker({ m }: { m: Member }) {
  const age = m.locationTs ? Date.now() - m.locationTs : Infinity;
  const stale = age > STALE_MS;
  const help = m.status === 'need_help';
  return (
    <Marker
      coordinate={m.location!}
      title={m.name}
      description={`${help ? 'Needs help' : m.status === 'safe' ? 'Safe' : 'No status'} · ${m.locationTs ? formatAge(age) : 'unknown'}`}
      anchor={{ x: 0, y: 0.5 }}
      opacity={stale && !help ? 0.5 : 1}
    >
      <View style={styles.memberWrap}>
        <View style={[styles.memberDot, m.status === 'unknown' ? styles.memberUnknown : { backgroundColor: statusColor[m.status] }]} />
        <Text style={[styles.memberTag, help && styles.memberTagHelp]}>{help ? `${m.name} needs help` : m.name}</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.card },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: 0 },
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
  memberWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberDot: { width: 16, height: 16, borderWidth: 1, borderColor: colors.bg },
  memberUnknown: { backgroundColor: colors.bg, borderColor: colors.text },
  memberTag: { fontSize: 13, fontWeight: '700', color: colors.text, backgroundColor: colors.bg, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
  memberTagHelp: { backgroundColor: colors.danger, color: colors.onDanger },
});
