// [OWNER: MAP/OFFLINE] Main map. Hold 1 s, slide to a group, let go = set that group's meeting place.
// Design: map + rounded bottom sheet: where you are going, then real labelled buttons.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Linking, Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '@/components/BigButton';
import { DangerBanner } from '@/components/DangerBanner';
import { GroupFilter } from '@/components/GroupFilter';
import { HoldGroupPicker, type PickOption } from '@/components/HoldGroupPicker';
import { MemberPin } from '@/components/MemberPin';
import { OfflineBanner } from '@/components/OfflineBanner';
import { distanceM, formatAge, formatDistance, nearestPlace } from '@/lib/geo';
import { allMemberIds, visibleMembers } from '@/lib/groups';
import { takeMapFocus } from '@/lib/mapFocus';
import { UW_CENTER } from '@/mocks/demo';
import { meetingSetBy } from '@/lib/meeting';
import { geocodeAddress } from '@/services/location';
import { DEMO_MODE, useApp } from '@/state/AppContext';
import { colors, groupColor, mapOverlayColors, memberColor, radius } from '@/theme';
import type { LatLng, Place } from '@/types';

const STALE_MS = 15 * 60_000;
const WALK_MPS = 1.3;

export default function MapScreen() {
  const { state, actions } = useApp();
  const overlay = mapOverlayColors(useColorScheme()); // map overlays need plain strings, not dynamic colors
  const { myUid, group, groups, visibleGroupIds, members, route, myLocation, isOnline, tiles, activeAlert, routingLoading, routingMessage, routeIsCached } = state;
  const needHelp = members.filter((m) => m.status === 'need_help');
  const mapRef = useRef<MapView>(null);
  // A place tapped on the map (safe area, or a meeting point we're not routed to) but not confirmed yet.
  const [pending, setPending] = useState<Place | null>(null);
  const [pendingKind, setPendingKind] = useState('Safe area');
  const pick = (place: Place, kind: string) => {
    setPending(place);
    setPendingKind(kind);
  };
  const [confirming, setConfirming] = useState(false);

  // Two ways to set a meeting point, both ending in the same naming box:
  //   1. hold a spot on the map (map frozen while choosing, preview pin), coord already known;
  //   2. "Set meeting point" in the panel: type an address, or use where I am now (coord null).
  const [mapLocked, setMapLocked] = useState(false);
  const [pendingPin, setPendingPin] = useState<LatLng | null>(null);
  const [naming, setNaming] = useState<{ coord: LatLng | null; option: PickOption; name: string; address: string } | null>(null);
  const [finding, setFinding] = useState(false);
  const pickOptions: PickOption[] = useMemo(
    () => (groups.length ? groups.map((g) => ({ id: g.id, label: g.id === group?.id ? `${g.name} (current)` : g.name })) : []),
    [groups, group?.id],
  );
  // Meeting points are shared with a group, so you need one first.
  const needsGroup = () => {
    if (groups.length) return false;
    Alert.alert('Join a group first', 'Meeting points are shared with a group. Create or join one on the Group tab.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Go to Group', onPress: () => router.navigate('/group') },
    ]);
    return true;
  };
  const lockedOffline = () => {
    if (isOnline) return false;
    Alert.alert('Meeting place locked offline', 'Reconnect to change the meeting place.');
    return true;
  };
  const startNaming = (coord: LatLng | null, option: PickOption) =>
    setNaming({ coord, option, name: coord ? 'Meeting place' : '', address: '' });
  const saveMeeting = async (coord: LatLng, address?: string) => {
    if (!naming) return;
    await actions.setMeetingPlace(coord, naming.name.trim() || address || 'Meeting place', naming.option.id ?? undefined, address);
    setNaming(null);
  };
  const saveFromAddress = async () => {
    const typed = naming?.address.trim();
    if (!typed) return Alert.alert('Enter an address', 'For example "4060 George Washington Ln NE, Seattle".');
    setFinding(true);
    const coord = await geocodeAddress(typed);
    setFinding(false);
    if (!coord) return Alert.alert('Couldn’t find that address', 'Check the spelling, add the city, or hold a spot on the map instead.');
    await saveMeeting(coord, typed);
  };
  const saveHere = () => {
    if (!myLocation) return Alert.alert('No location yet', 'Wait for GPS, type an address, or hold a spot on the map.');
    void saveMeeting(myLocation);
  };

  // ---- Swipeable panel: two positions ----
  //   open:      sized to its content (no empty space), every action
  //   collapsed: just the handle + where you're going (the map leads)
  // Animated with the JS driver on purpose: with the native driver, a re-render right after a
  // swipe briefly redrew the panel at a stale position (the "whole menu flashes" glitch).
  const { height: screenH } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
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

  // Picked another group on the Group tab: when the Map comes back into view, center on that group's
  // meeting point. If we're walking somewhere else, offer it in the panel ("Go to …"); never auto-route.
  useFocusEffect(
    useCallback(() => {
      const f = takeMapFocus();
      if (!f) return;
      const { place, label } = f;
      mapRef.current?.animateToRegion({ ...place.coord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
      const routedThere = !!route && route.to.latitude === place.coord.latitude && route.to.longitude === place.coord.longitude;
      if (route && !routedThere) pick(place, label);
    }, [route]),
  );

  // Open the alert screen whenever a new alert arrives.
  useEffect(() => {
    if (activeAlert) router.push('/alert');
  }, [activeAlert?.id]);

  // The current group can be unchecked in the group filter too: then its meeting point is hidden.
  const currentHidden = !!group && !visibleGroupIds.includes(group.id);
  const meetingPlace = group && !currentHidden ? group.meetingPlace : null;
  // Members of the checked groups, one pin per person even if they share several groups with me.
  const shownMembers = useMemo(() => visibleMembers(members, groups, visibleGroupIds), [members, groups, visibleGroupIds]);
  // Color by position across ALL my groups (current group first) so a person keeps one color.
  const colorOrder = useMemo(() => allMemberIds(group ? [group, ...groups] : groups), [group, groups]);
  const center = myLocation ?? meetingPlace?.coord ?? UW_CENTER;

  // What the sheet points at: the active route's target, else the meeting place, else the nearest safe area.
  const target =
    (route && { name: route.targetName, coord: route.to, label: 'Heading to' }) ??
    (meetingPlace && { name: meetingPlace.name, coord: meetingPlace.coord, label: 'Meeting point' }) ??
    (() => {
      const p = myLocation && group ? nearestPlace(myLocation, group.safeAreas) : null;
      return p ? { name: p.name, coord: p.coord, label: 'Nearest safe area' } : null;
    })();
  const meters = route ? route.distanceM : target && myLocation ? distanceM(myLocation, target.coord) : null;
  const minutes = route && !route.isStraightLine ? route.durationS / 60 : meters !== null ? meters / WALK_MPS / 60 : null;
  const walk = minutes !== null ? `${Math.max(1, Math.round(minutes))} min walk` : null;
  // [UI] "Set by Sam, 5 min ago" when the panel is showing the meeting point.
  const setByLine =
    meetingPlace && (target?.label === 'Meeting point' || route?.targetId === meetingPlace.id) ? meetingSetBy(meetingPlace, myUid) : null;

  // The route already on screen goes to the current target, so the main button has nothing to do
  // (it stays greyed) until a new place is picked. A failed walking route can still be retried.
  // Someone else in the group moved the meeting point after this route was drawn.
  const meetingMoved =
    !!route && !!meetingPlace && route.targetId === meetingPlace.id &&
    (route.to.latitude !== meetingPlace.coord.latitude || route.to.longitude !== meetingPlace.coord.longitude);
  const routeShown = !!route && !routingLoading && !meetingMoved;
  // Identity of the drawn route (see the Polylines below).
  const routeKey = route ? `${route.to.latitude},${route.to.longitude}:${route.fetchedAt}:${route.points.length}` : '';
  const canRetry = routeShown && route!.isStraightLine && isOnline;
  const goDisabled = !target || (routeShown && !canRetry);
  const goLabel = routingLoading
    ? 'Finding walking route…'
    : !target
      ? currentHidden ? 'Group hidden on map' : 'Set a meeting point first'
      : meetingMoved
        ? 'Route to new meeting point'
        : canRetry
          ? 'Retry walking route'
          : routeShown
            ? 'Route shown'
            : target.label === 'Nearest safe area'
              ? 'Go to nearest safe area'
              : 'Go to meeting point';
  const summary = target
    ? `${target.label}${meters !== null ? `, ${formatDistance(meters)} away` : ''}${walk ? ` (about ${walk})` : ''}`
    : currentHidden
      ? `${group!.name} is hidden. Turn it on in the group filter to see its meeting point.`
      : group
        ? 'Hold a spot on the map to drop a meeting point.'
        : 'Join a group on the Group tab to set a meeting point.';

  // Pending selection: what it is, how far, and what confirming will do.
  const pendingMeters = pending && myLocation ? distanceM(myLocation, pending.coord) : null;
  const pendingTitle = pending?.name ?? '';
  const pendingSummary = `${pendingMeters !== null ? `${formatDistance(pendingMeters)} away. ` : ''}${pendingKind}.`;
  const confirmPending = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      await actions.routeTo(pending);
    } finally {
      setConfirming(false);
      setPending(null);
    }
  };

  // Each group has its own meeting place (in that group's color): the current group's plus every checked group's.
  // Other groups' points are drawn faint (40%) so the current group's point stands out.
  const groupIds = groups.map((g) => g.id);
  const meetingMarkers = groups.length
    ? groups
        .filter((g) => g.meetingPlace && visibleGroupIds.includes(g.id))
        .map((g) => ({ key: `meet-${g.id}`, place: g.meetingPlace!, groupName: g.name as string | null, description: `${g.name} meeting place${g.meetingPlace!.address ? ` · ${g.meetingPlace!.address}` : ''}`, current: g.id === group?.id, color: groupColor(g.id, groupIds) as string | null }))
    : [];
  // Unchecking a group in the filter hides its meeting point, so drop a route or a pending
  // "Go to …" that leads there (unless a shown group happens to meet at the same spot).
  const sameSpot = (a: LatLng, b: LatLng) => a.latitude === b.latitude && a.longitude === b.longitude;
  const hiddenMeetingSpot = (c: LatLng) =>
    groups.some((g) => g.meetingPlace && !visibleGroupIds.includes(g.id) && sameSpot(g.meetingPlace.coord, c)) &&
    !meetingMarkers.some((m) => sameSpot(m.place.coord, c));
  useEffect(() => {
    if (route && hiddenMeetingSpot(route.to)) actions.clearRoute();
    if (pending && hiddenMeetingSpot(pending.coord)) setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleGroupIds, groups, route?.to.latitude, route?.to.longitude, pending?.coord.latitude, pending?.coord.longitude]);

  // Already walking there? Then tapping its pin needs no new "Go" button.
  const isRoutedTo = (p: Place) =>
    !!route && route.to.latitude === p.coord.latitude && route.to.longitude === p.coord.longitude;
  const onMeetingPress = (m: (typeof meetingMarkers)[number]) => {
    if (isRoutedTo(m.place)) return;
    // Unique id per group so route-target checks can tell groups' meeting points apart.
    pick({ ...m.place, id: m.key, name: m.groupName ? `${m.place.name} (${m.groupName})` : m.place.name }, m.groupName ? `${m.groupName} meeting point` : 'My meeting point');
  };

  return (
    <View style={styles.fill}>
      <HoldGroupPicker
        options={pickOptions}
        getCoordinate={async (pt) => (mapRef.current ? mapRef.current.coordinateForPoint(pt) : null)}
        canStart={() => !needsGroup() && !lockedOffline()}
        onLockMap={setMapLocked}
        onPendingChange={setPendingPin}
        onPick={(coord, option) => startNaming(coord, option)}
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
        // Android (New Architecture): setting mapPadding before the Google map exists crashes
        // with a NullPointerException in setPadding. Only pass it once the map reports ready.
        onMapReady={() => setMapReady(true)}
        mapPadding={mapReady ? { top: 0, left: 0, right: 0, bottom: open ? fullH : closedH } : undefined}
      >
        {activeAlert?.areas.map((ring, i) => (
          <Polygon key={`area-${i}`} coordinates={ring} fillColor="rgba(179,38,30,0.14)" strokeColor={overlay.danger} strokeWidth={2} />
        ))}

        {/* Route: Apple Maps style, a thick bright blue line with a thin darker border.
            Re-keyed on the route itself: Apple Maps doesn't reliably redraw a line whose points
            change in place, so a moved meeting point kept showing the old line. */}
        {route && (
          <Polyline
            key={`casing-${overlay.routeCasing}-${routeKey}`}
            coordinates={route.points}
            strokeColor={overlay.routeCasing}
            strokeWidth={10}
            lineCap="round"
            lineJoin="round"
            lineDashPattern={route.isStraightLine ? [14, 10] : undefined}
            zIndex={1}
          />
        )}
        {route && (
          <Polyline
            key={`route-${overlay.route}-${routeKey}`}
            coordinates={route.points}
            strokeColor={overlay.route}
            strokeWidth={7}
            lineCap="round"
            lineJoin="round"
            lineDashPattern={route.isStraightLine ? [14, 10] : undefined}
            zIndex={2}
          />
        )}

        {meetingMarkers.map((m) => (
          // Re-keyed on color: custom marker views aren't reliably redrawn in place.
          <Marker key={`${m.key}-${m.color}`} coordinate={m.place.coord} title={m.place.name} description={m.description} anchor={{ x: 0.5, y: 0.5 }} opacity={m.current ? 1 : 0.4} onPress={() => onMeetingPress(m)}>
            <View style={[styles.meetingMarker, m.color ? { backgroundColor: m.color, borderColor: '#FFFFFF' } : null]} />
          </Marker>
        ))}

        {pendingPin && (
          <Marker coordinate={pendingPin} title="New meeting point" description="Not saved yet" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.meetingMarker, styles.pendingMarker]} />
          </Marker>
        )}

        {group?.safeAreas.map((p) => (
          <Marker key={p.id} coordinate={p.coord} title={p.name} description="Safe area" anchor={{ x: 0.5, y: 0.5 }} onPress={() => { if (!isRoutedTo(p)) pick(p, 'Safe area'); }}>
            <View style={styles.safeMarker} />
          </Marker>
        ))}

        {shownMembers.map((m) => {
          if (!m.location) return null;
          const age = m.locationTs ? Date.now() - m.locationTs : Infinity;
          const color = memberColor(m.uid, colorOrder);
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
      </HoldGroupPicker>

      <Modal visible={!!naming} transparent animationType="fade" onRequestClose={() => setNaming(null)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior="padding">
          <View style={styles.modalCard}>
            <Text style={styles.targetName}>{naming?.coord ? 'Name this meeting point' : 'Set meeting point'}</Text>
            <Text style={styles.summary}>For {naming?.option.label.replace(' (current)', '')}</Text>
            <TextInput
              style={styles.modalInput}
              value={naming?.name ?? ''}
              onChangeText={(name) => setNaming((n) => (n ? { ...n, name } : n))}
              autoFocus={!!naming?.coord}
              selectTextOnFocus
              placeholder="Name, e.g. Front lawn"
              placeholderTextColor={colors.muted}
              onSubmitEditing={() => naming?.coord && void saveMeeting(naming.coord)}
              returnKeyType="done"
              accessibilityLabel="Meeting point name"
            />
            {naming?.coord ? (
              <BigButton label="Save meeting point" icon="flag" onPress={() => naming.coord && void saveMeeting(naming.coord)} />
            ) : (
              <>
                <TextInput
                  style={styles.modalInput}
                  value={naming?.address ?? ''}
                  onChangeText={(address) => setNaming((n) => (n ? { ...n, address } : n))}
                  autoFocus
                  editable={!finding}
                  autoCorrect={false}
                  placeholder="Address, e.g. 4060 George Washington Ln NE, Seattle"
                  placeholderTextColor={colors.muted}
                  onSubmitEditing={() => void saveFromAddress()}
                  returnKeyType="search"
                  accessibilityLabel="Meeting point address"
                />
                {naming?.address.trim() ? (
                  <BigButton label="Use this address" icon="search" loading={finding} onPress={() => void saveFromAddress()} />
                ) : (
                  <BigButton label="Use where I am now" icon="locate" onPress={saveHere} />
                )}
                <Text style={styles.summary}>Or close this and hold a spot on the map for 1 second.</Text>
              </>
            )}
            <BigButton label="Cancel" variant="plain" disabled={finding} onPress={() => setNaming(null)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
        {!isOnline && tiles?.downloadedAt && <Text style={styles.notice}>Using the area saved {formatAge(Date.now() - tiles.downloadedAt)}. Meeting point can’t change offline.</Text>}
        {!isOnline && !tiles?.downloadedAt && <Text style={styles.notice}>Apple Maps shows cached areas only. Meeting point can’t change while offline.</Text>}
        {routingMessage && <Text style={styles.notice}>{routingMessage}</Text>}
        {DEMO_MODE && <Text style={styles.demo}>Demo mode</Text>}
        <GroupFilter groups={groups} visibleIds={visibleGroupIds} onToggle={actions.toggleGroupVisible} colorFor={(id) => groupColor(id, groupIds)} />
      </SafeAreaView>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
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
              {!pending && setByLine && <Text style={styles.setBy} numberOfLines={1}>{setByLine}</Text>}
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
              <BigButton label={`Go to ${pending.name}`} icon="navigate" loading={confirming} onPress={() => void confirmPending()} />
              <BigButton label="Cancel" variant="plain" disabled={confirming} onPress={() => setPending(null)} />
            </>
          ) : (
            <>
              <BigButton
                label={goLabel}
                icon={routeShown && !canRetry ? 'checkmark' : 'navigate'}
                loading={routingLoading}
                disabled={goDisabled}
                accessibilityHint={routeShown && !canRetry ? 'Hold a spot on the map to pick a new meeting point' : undefined}
                onPress={() => void actions.routeToBestTarget()}
              />
              <BigButton
                label={group?.meetingPlace ? 'Change meeting point' : 'Set meeting point'}
                icon="flag-outline"
                variant="secondary"
                accessibilityHint="Type an address or use where you are. You can also hold a spot on the map."
                onPress={() => {
                  if (needsGroup() || lockedOffline()) return;
                  const current = pickOptions.find((o) => o.id === (group?.id ?? null)) ?? pickOptions[0];
                  startNaming(null, current);
                }}
              />
              <View style={styles.row}>
                <BigButton label="Compass" icon="compass-outline" variant="secondary" style={styles.half} onPress={() => router.push('/compass')} />
                <BigButton
                  label={tiles?.downloadedAt ? 'Offline ready' : 'Get offline-ready'}
                  icon={tiles?.downloadedAt ? 'checkmark-circle-outline' : 'cloud-download-outline'}
                  variant="secondary"
                  style={styles.half}
                  accessibilityHint="Checks and saves what you need to use the map without signal"
                  onPress={() => router.push('/offline-readiness')}
                />
              </View>
              <BigButton label="Practice a drill" icon="warning-outline" variant="alarm" accessibilityHint="Practice a disaster. Your group gets the drill too." onPress={() => router.push('/simulate')} />
            </>
          )}

          {route && (
            <Text style={styles.fine}>
              {route.isStraightLine ? 'Straight-line direction. ' : 'Walking route. '}
              {!route.isStraightLine && (routeIsCached || !isOnline) ? `Saved ${formatAge(Math.max(0, Date.now() - route.fetchedAt))}. ` : ''}
              {'Routes don’t avoid hazards. '}
              <Text style={styles.link} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>© OpenStreetMap</Text>
              {' · '}
              <Text style={styles.link} onPress={() => Linking.openURL('https://routing.openstreetmap.de/about.html')}>FOSSGIS</Text>
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
  setBy: { fontSize: 13, lineHeight: 18, color: colors.muted },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  fine: { fontSize: 12, lineHeight: 16, color: colors.muted, paddingHorizontal: 4 },
  link: { textDecorationLine: 'underline' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.bg, borderRadius: 20, padding: 20, gap: 10 },
  modalInput: { minHeight: 56, backgroundColor: colors.card, color: colors.text, borderRadius: radius, paddingHorizontal: 16, fontSize: 17 },

  meetingMarker: { width: 22, height: 22, borderRadius: 4, backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.text, transform: [{ rotate: '45deg' }] },
  pendingMarker: { borderStyle: 'dashed', backgroundColor: colors.card, opacity: 0.9 },
  safeMarker: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.safe, borderWidth: 2, borderColor: colors.bg },
});
