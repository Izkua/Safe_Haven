// [OWNER: MAP/OFFLINE] Main map. Long-press = set meeting place.
// Design: map + rounded bottom sheet: where you are going, then real labelled buttons.
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Linking, PanResponder, Platform, Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import MapView, { LocalTile, Marker, Polygon, Polyline, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { DangerBanner } from '@/components/DangerBanner';
import { MemberPin } from '@/components/MemberPin';
import { OfflineBanner } from '@/components/OfflineBanner';
import { distanceM, formatAge, formatDistance, nearestPlace } from '@/lib/geo';
import { UW_CENTER } from '@/mocks/demo';
import { downloadRegion, localTilePath, ONLINE_TILE_URL, planTiles, TILE_ATTRIBUTION, tileConfigurationError } from '@/services/tiles';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, mapOverlayColors, memberColor, radius } from '@/theme';
import type { LatLng, Place } from '@/types';

const STALE_MS = 15 * 60_000;
const WALK_MPS = 1.3;
// Android's Google base map often renders blank in Expo Go (Play services / API key issues).
// With a tile key configured, draw configured raster tiles instead — same provider as the offline cache.
const USE_TILE_BASEMAP = Platform.OS === 'android' && !!ONLINE_TILE_URL;

export default function MapScreen() {
  const { state, actions } = useApp();
  const overlay = mapOverlayColors(useColorScheme()); // map overlays need plain strings, not dynamic colors
  const { group, personalMeetingPlace, members, route, myLocation, isOnline, tiles, activeAlert, routingLoading, routingMessage, routeIsCached } = state;
  const needHelp = members.filter((m) => m.status === 'need_help');
  const mapRef = useRef<MapView>(null);
  const downloadBusy = useRef(false);
  const [tileProgress, setTileProgress] = useState<string | null>(null);
  // A place picked on the map but not confirmed yet: a long-press (new meeting point) or a tapped safe area.
  const [pending, setPending] = useState<{ kind: 'meeting'; coord: LatLng } | { kind: 'place'; place: Place } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // ---- Swipeable panel: two positions ----
  //   open:      at least half the screen, every action
  //   collapsed: just the handle + where you're going (the map leads)
  // Animated with the JS driver on purpose: with the native driver, a re-render right after a
  // swipe briefly redrew the panel at a stale position (the "whole menu flashes" glitch).
  const { height: screenH } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [closedH, setClosedH] = useState(96); // handle + destination
  const [fullH, setFullH] = useState(Math.round(screenH * 0.5)); // whole panel
  const closedOffset = Math.max(0, fullH - closedH);
  const sheetY = useRef(new Animated.Value(closedOffset)).current;
  const dragStart = useRef(0);
  const animateTo = (toValue: number) =>
    Animated.spring(sheetY, { toValue, useNativeDriver: false, bounciness: 0, speed: 20 }).start();
  const snap = (next: boolean) => {
    setOpen(next);
    animateTo(next ? 0 : closedOffset);
  };
  // Keep the panel pinned to its position when its measured size changes.
  useEffect(() => {
    animateTo(open ? 0 : closedOffset);
  }, [closedOffset]);
  // Picking a place on the map needs its Confirm / Cancel buttons in view.
  useEffect(() => {
    if (pending && !open) snap(true);
  }, [pending]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => sheetY.stopAnimation((v) => (dragStart.current = v)),
        onPanResponderMove: (_, g) => sheetY.setValue(Math.min(closedOffset, Math.max(0, dragStart.current + g.dy))),
        onPanResponderRelease: (_, g) => {
          const at = Math.min(closedOffset, Math.max(0, dragStart.current + g.dy));
          // A flick decides; otherwise whichever position is nearer. A pending pick can't be hidden.
          const next = g.vy < -0.3 ? true : g.vy > 0.3 ? false : at < closedOffset / 2;
          snap(pending ? true : next);
        },
        onPanResponderTerminate: () => snap(open),
      }),
    [closedOffset, open, pending],
  );

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
  // The route already on screen goes to the current target, so the main button has nothing to do
  // (it stays greyed) until a new place is picked. A failed walking route can still be retried.
  // Someone else in the group moved the meeting point after this route was drawn.
  const meetingMoved =
    !!route && !!meetingPlace && route.targetId === meetingPlace.id &&
    (route.to.latitude !== meetingPlace.coord.latitude || route.to.longitude !== meetingPlace.coord.longitude);
  const routeShown = !!route && !routingLoading && !meetingMoved;
  const canRetry = routeShown && route!.isStraightLine && isOnline;
  const goDisabled = !target || (routeShown && !canRetry);
  const goLabel = routingLoading
    ? "Finding walking route…"
    : !target
      ? "Set a meeting point first"
      : meetingMoved
        ? "Route to new meeting point"
        : canRetry
        ? "Retry walking route"
        : routeShown
          ? "Route shown"
          : target.label === "Nearest safe area"
            ? "Go to nearest safe area"
            : "Go to meeting point";
  const summary = target
    ? `${target.label}${meters !== null ? `, ${formatDistance(meters)} away` : ""}${walk ? ` (about ${walk})` : ""}`
    : "Long-press the map to drop a meeting point.";

  // Pending selection: what it is, how far, and what confirming will do.
  const pendingCoord = pending ? (pending.kind === 'meeting' ? pending.coord : pending.place.coord) : null;
  const pendingMeters = pendingCoord && myLocation ? distanceM(myLocation, pendingCoord) : null;
  const pendingTitle = pending?.kind === 'meeting' ? 'New meeting point' : pending?.place.name ?? '';
  const pendingSummary = `${pendingMeters !== null ? `${formatDistance(pendingMeters)} away. ` : ''}${
    pending?.kind === 'meeting' ? 'Your group will see this as the meeting point.' : 'Safe area.'
  }`;
  const confirmPending = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      if (pending.kind === 'meeting') await actions.setMeetingPlace(pending.coord);
      else await actions.routeTo(pending.place);
    } finally {
      setConfirming(false);
      setPending(null);
    }
  };
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
        mapPadding={{ top: 0, left: 0, right: 0, bottom: open ? fullH : closedH }}
        onLongPress={(e) => {
          if (!isOnline) { Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.'); return; }
          // Only select it; nothing changes until the user confirms in the sheet.
          setPending({ kind: 'meeting', coord: e.nativeEvent.coordinate });
        }}
      >
        {USE_TILE_BASEMAP && isOnline && <UrlTile urlTemplate={ONLINE_TILE_URL} tileSize={256} maximumZ={19} />}
        {!isOnline && tiles && <LocalTile key={tiles.downloadedAt} pathTemplate={localTilePath(tiles)} tileSize={256} />}

        {activeAlert?.areas.map((ring, i) => (
          <Polygon key={`area-${i}`} coordinates={ring} fillColor="rgba(179,38,30,0.14)" strokeColor={overlay.danger} strokeWidth={2} />
        ))}

        {/* Route: bright blue over a darker casing so it stands out on any tile, light or dark. */}
        {route && (
          <Polyline
            key={`casing-${overlay.routeCasing}`}
            coordinates={route.points}
            strokeColor={overlay.routeCasing}
            strokeWidth={9}
            lineCap="round"
            lineJoin="round"
            lineDashPattern={route.isStraightLine ? [14, 10] : undefined}
            zIndex={1}
          />
        )}
        {route && (
          <Polyline
            key={`route-${overlay.route}`}
            coordinates={route.points}
            strokeColor={overlay.route}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            lineDashPattern={route.isStraightLine ? [14, 10] : undefined}
            zIndex={2}
          />
        )}

        {meetingPlace && (
          <Marker coordinate={meetingPlace.coord} title={meetingPlace.name} description={group ? 'Group meeting place' : 'Personal meeting place'} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.meetingMarker} />
          </Marker>
        )}

        {pending?.kind === 'meeting' && (
          <Marker coordinate={pending.coord} title="New meeting point" description="Not saved yet" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.meetingMarker, styles.pendingMarker]} />
          </Marker>
        )}

        {group?.safeAreas.map((p) => (
          <Marker key={p.id} coordinate={p.coord} title={p.name} description="Safe area" anchor={{ x: 0.5, y: 0.5 }} onPress={() => setPending({ kind: 'place', place: p })}>
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
              description={`${help ? 'Needs help' : m.status === 'safe' ? 'Safe' : 'No check-in'}, ${m.locationTs ? formatAge(age) : 'location unknown'}`}
              anchor={{ x: 0.5, y: 0.5 }}
              opacity={age > STALE_MS && !help ? 0.45 : 1}
            >
              <MemberPin name={m.name} color={color} status={m.status} />
            </Marker>
          );
        })}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        {/* Live danger first: it must stay visible after the alert screen closes. */}
        {activeAlert && (
          <DangerBanner
            icon="warning"
            title={`${activeAlert.source === 'simulated' ? 'Drill: ' : ''}${activeAlert.title.replace(/\s*\(SIMULATED\)\s*/i, '')}`}
            action="Tap to see what to do"
            onPress={() => router.push('/alert')}
          />
        )}
        {needHelp.length > 0 && (
          <DangerBanner
            icon="alert-circle"
            title={needHelp.length === 1 ? `${needHelp[0].name} needs help` : `${needHelp.length} people need help`}
            action="Tap to see where"
            onPress={() => router.navigate('/group')}
          />
        )}
        <OfflineBanner />
        {!isOnline && tiles && <Text style={styles.notice}>Using the map saved {formatAge(Date.now() - tiles.downloadedAt)}. Meeting point can’t change offline.</Text>}
        {!isOnline && !tiles && <Text style={styles.notice}>Meeting point can’t change while offline.</Text>}
        {routingMessage && <Text style={styles.notice}>{routingMessage}</Text>}
        {DEMO_MODE && <Text style={styles.demo}>Demo mode</Text>}
      </SafeAreaView>

      <Animated.View
        style={[styles.sheet, { minHeight: Math.round(screenH * 0.5), transform: [{ translateY: sheetY }] }]}
        onLayout={(e) => setFullH(e.nativeEvent.layout.height)}
      >
        {/* Always visible. Drag it, or tap it, to open or close the panel. */}
        <View {...pan.panHandlers} onLayout={(e) => setClosedH(e.nativeEvent.layout.y + e.nativeEvent.layout.height + 10)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${pending ? pendingTitle : target ? target.name : 'No meeting point yet'}. ${open ? 'Hide options' : 'Show options'}`}
            accessibilityState={{ expanded: open }}
            onPress={() => snap(pending ? true : !open)}
          >
            <View style={styles.grab}>
              <View style={styles.handle} />
            </View>
            <View style={styles.sheetHead}>
              <Text style={styles.targetName} numberOfLines={1}>
                {pending ? pendingTitle : target ? target.name : 'No meeting point yet'}
              </Text>
              <Text style={styles.summary} numberOfLines={2}>{pending ? pendingSummary : summary}</Text>
            </View>
          </Pressable>
        </View>

        {/* Shown when open. */}
        <View
          style={styles.more}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          pointerEvents={open ? 'auto' : 'none'}
        >
          {pending ? (
            <>
              <BigButton
                label={pending.kind === 'meeting' ? 'Set as meeting point' : `Go to ${pending.place.name}`}
                icon={pending.kind === 'meeting' ? 'flag' : 'navigate'}
                loading={confirming}
                onPress={() => void confirmPending()}
              />
              <BigButton label="Cancel" variant="plain" disabled={confirming} onPress={() => setPending(null)} />
            </>
          ) : (
            <>
              <BigButton
                label={goLabel}
                icon={routeShown && !canRetry ? 'checkmark' : 'navigate'}
                loading={routingLoading}
                disabled={goDisabled}
                accessibilityHint={routeShown && !canRetry ? 'Long-press the map to pick a new meeting point' : undefined}
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
              <BigButton label="Practice a drill" icon="warning-outline" variant="alarm" accessibilityHint="Practice a disaster. Your group gets the drill too." onPress={() => router.push('/simulate')} />
            </>
          )}

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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, gap: 8 },
  notice: { backgroundColor: colors.card, color: colors.text, fontSize: 15, lineHeight: 20, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius, overflow: 'hidden' },
  demo: { alignSelf: 'flex-start', backgroundColor: colors.card, color: colors.muted, fontSize: 13, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 12 },
  grab: { alignItems: 'center', justifyContent: 'center', height: 26 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.muted, opacity: 0.6 },
  more: { paddingTop: 12, gap: 10 },
  sheetHead: { gap: 2, paddingHorizontal: 4, marginBottom: 4 },
  targetName: { fontSize: 20, lineHeight: 25, fontWeight: '600', color: colors.text },
  summary: { fontSize: 15, lineHeight: 20, color: colors.muted },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  fine: { fontSize: 12, lineHeight: 16, color: colors.muted, paddingHorizontal: 4 },
  link: { textDecorationLine: 'underline' },

  meetingMarker: { width: 22, height: 22, borderRadius: 4, backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.text, transform: [{ rotate: '45deg' }] },
  pendingMarker: { borderStyle: 'dashed', backgroundColor: colors.card, opacity: 0.9 },
  safeMarker: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.safe, borderWidth: 2, borderColor: colors.bg },
});
