// Single app store shared by every screen. Services write into it; screens read from it.
// Keeps an offline snapshot on disk so the app is useful with zero network after relaunch.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { nearestPlace } from '@/lib/geo';
import { allMemberIds, upsertGroup } from '@/lib/groups';
import { meetingPlaceOk, pickSafeTarget } from '@/lib/hazards';
import { DEMO_GROUP, DEMO_MEMBERS, UW_CENTER } from '@/mocks/demo';
import * as alerts from '@/services/alerts';
import { canChangeMeetingPlace, subscribeOnline } from '@/services/connectivity';
import * as fb from '@/services/firebase';
import * as loc from '@/services/location';
import { loadSnapshot, saveSnapshot } from '@/services/offline';
import { loadSavedTileRegion } from '@/services/tiles';
import { createRouteRequestGuard, fallbackRoute, fetchWalkingRoute } from '@/services/routing';
import type { Group, HazardAlert, LatLng, Member, MemberStatus, Place, Route, TileRegion } from '@/types';

export const DEMO_MODE = !fb.isFirebaseConfigured;

export interface AppState {
  hydrated: boolean;
  personalMeetingPlace: Place | null;
  routingLoading: boolean;
  routingMessage: string | null;
  routeIsCached: boolean;
  myUid: string | null;
  myName: string;
  myLocation: LatLng | null;
  myStatus: MemberStatus;
  /** Every group I'm in. */
  groups: Group[];
  /** The "current" group: meeting place, safe areas and routing use this one. */
  activeGroupId: string | null;
  /** Derived from groups + activeGroupId (never set directly). */
  group: Group | null;
  /** Groups whose members are shown on the map. */
  visibleGroupIds: string[];
  /** Everyone in any of my groups except me, one entry per person. */
  members: Member[];
  route: Route | null;
  tiles: TileRegion | null;
  activeAlert: HazardAlert | null;
  isOnline: boolean;
  lastSyncedAt: number | null;
}

type Action =
  | { type: 'hydrate'; patch: Partial<AppState> }
  | { type: 'set'; patch: Partial<AppState> }
  /** Add or refresh a group. `select` also makes it current and visible on the map. */
  | { type: 'upsertGroup'; group: Group; select?: boolean }
  | { type: 'removeGroup'; id: string };

const initial: AppState = {
  hydrated: false,
  personalMeetingPlace: null,
  routingLoading: false,
  routingMessage: null,
  routeIsCached: false,
  myUid: null,
  myName: 'Me',
  myLocation: null,
  myStatus: 'unknown',
  groups: [],
  activeGroupId: null,
  group: null,
  visibleGroupIds: [],
  members: [],
  route: null,
  tiles: null,
  activeAlert: null,
  isOnline: true,
  lastSyncedAt: null,
};

/** Keeps `group`, `activeGroupId` and `visibleGroupIds` consistent with `groups`. */
function normalize(s: AppState): AppState {
  const group = s.groups.find((g) => g.id === s.activeGroupId) ?? s.groups[0] ?? null;
  const ids = new Set(s.groups.map((g) => g.id));
  // Drop people who are no longer in any of my groups (e.g. after leaving one).
  const memberIds = new Set(allMemberIds(s.groups));
  return {
    ...s,
    group,
    activeGroupId: group?.id ?? null,
    visibleGroupIds: s.visibleGroupIds.filter((id) => ids.has(id)),
    members: s.members.filter((m) => memberIds.has(m.uid)),
  };
}

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'hydrate':
      return normalize({ ...s, ...a.patch, hydrated: true });
    case 'set':
      return normalize({ ...s, ...a.patch });
    case 'upsertGroup': {
      const isNew = !s.groups.some((g) => g.id === a.group.id);
      return normalize({
        ...s,
        groups: upsertGroup(s.groups, a.group),
        activeGroupId: a.select ? a.group.id : s.activeGroupId,
        // New groups start visible on the map.
        visibleGroupIds: (isNew || a.select) && !s.visibleGroupIds.includes(a.group.id) ? [...s.visibleGroupIds, a.group.id] : s.visibleGroupIds,
      });
    }
    case 'removeGroup':
      return normalize({ ...s, groups: s.groups.filter((g) => g.id !== a.id), route: s.activeGroupId === a.id ? null : s.route });
  }
}

export interface AppActions {
  setMeetingPlace(coord: LatLng, name?: string): Promise<void>;
  addSafeArea(coord: LatLng, name: string): Promise<void>;
  routeTo(target: Place): Promise<void>;
  routeToBestTarget(): Promise<void>;
  setStatus(status: MemberStatus): Promise<void>;
  setName(name: string): Promise<void>;
  createGroup(name: string): Promise<boolean>;
  joinGroup(code: string): Promise<boolean>;
  /** Leaves the current group (others stay). */
  leaveGroup(): void;
  /** Makes a group the current one. */
  selectGroup(id: string): void;
  /** Shows/hides a group's members on the map. */
  toggleGroupVisible(id: string): void;
  triggerAlert(alert: HazardAlert): Promise<void>;
  dismissAlert(): void;
  setTiles(tiles: TileRegion | null): void;
  setPreparedOffline(route: Route, tiles: TileRegion | null): void;
}

const Ctx = createContext<{ state: AppState; actions: AppActions } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const set = useCallback((patch: Partial<AppState>) => dispatch({ type: 'set', patch }), []);
  const stateRef = useRef(state);
  stateRef.current = state;
  const beginRouteRequest = useRef(createRouteRequestGuard()).current;
  const lastPublished = useRef<{ coord: LatLng; ts: number } | null>(null);

  // 1. Hydrate from disk first so offline launch shows the last-known world.
  useEffect(() => {
    (async () => {
      let snap = await loadSnapshot();
      const savedTiles = await loadSavedTileRegion();
      // Older snapshots stored a single group.
      let savedGroups = snap?.groups ?? (snap?.group ? [snap.group] : []);
      // A saved demo group must never shadow the real join/create screen when Firebase is configured.
      if (!DEMO_MODE) savedGroups = savedGroups.filter((g) => g.id !== 'demo-group');
      if (DEMO_MODE && !savedGroups.length) savedGroups = [DEMO_GROUP];
      // Only trust a uid that actually signed in; a stale cached uid means unauthenticated requests.
      const uid = await fb.ensureSignedIn().catch(() => null);
      dispatch({
        type: 'hydrate',
        patch: {
          myUid: uid,
          myName: snap?.myName ?? 'Me',
          personalMeetingPlace: snap?.personalMeetingPlace ?? null,
          groups: savedGroups,
          activeGroupId: snap?.activeGroupId ?? snap?.group?.id ?? savedGroups[0]?.id ?? null,
          visibleGroupIds: snap?.visibleGroupIds ?? savedGroups.map((g) => g.id),
          members: snap?.members?.length ? snap.members : DEMO_MODE ? DEMO_MEMBERS : [],
          route: snap?.route ?? null,
          routeIsCached: !!snap?.route,
          tiles: savedTiles ?? snap?.tiles ?? null,
          lastSyncedAt: snap?.savedAt ?? null,
        },
      });

      // Pick up groups joined on another device or lost with cleared storage.
      if (!DEMO_MODE && uid) {
        const remote = await fb.findMyGroups(uid);
        for (const g of remote) dispatch({ type: 'upsertGroup', group: g });
      }
    })();
  }, []);

  // 2. Connectivity.
  useEffect(() => subscribeOnline((isOnline) => set({ isOnline })), [set]);

  // 2b. If sign-in failed at launch (offline / flaky Wi-Fi), retry when we're back online.
  useEffect(() => {
    if (!state.hydrated || state.myUid || !state.isOnline || DEMO_MODE) return;
    fb.ensureSignedIn().then((uid) => set({ myUid: uid })).catch(() => {});
  }, [state.hydrated, state.personalMeetingPlace, state.myUid, state.isOnline, set]);

  // 3. Foreground location + throttled publish.
  const publishIfDue = useCallback((coord: LatLng) => {
    const { myUid, isOnline } = stateRef.current;
    if (!myUid || !isOnline || !loc.shouldPublish(lastPublished.current, coord)) return;
    lastPublished.current = { coord, ts: Date.now() };
    fb.publishLocation(myUid, coord).catch(() => {});
  }, []);
  useEffect(() => {
    let stop: (() => void) | undefined;
    (async () => {
      if (!(await loc.requestForegroundPermission())) {
        if (DEMO_MODE) set({ myLocation: UW_CENTER });
        return;
      }
      stop = await loc.startForegroundWatch((coord) => {
        set({ myLocation: coord });
        publishIfDue(coord);
      });
    })();
    return () => stop?.();
  }, [set, publishIfDue]);
  // The first GPS fix can arrive before sign-in finishes (or while offline): publish once we can.
  useEffect(() => {
    const coord = stateRef.current.myLocation;
    if (coord) publishIfDue(coord);
  }, [state.myUid, state.isOnline, publishIfDue]);
  // The watch only fires after movement, so a phone standing still would never re-publish.
  // Heartbeat checks a few times per interval so the max-interval publish isn't skipped by timer drift.
  useEffect(() => {
    const id = setInterval(() => {
      const coord = stateRef.current.myLocation;
      if (coord) publishIfDue(coord);
    }, loc.PUBLISH_MAX_INTERVAL_MS / 4);
    return () => clearInterval(id);
  }, [publishIfDue]);

  // 4. Live groups + members. One listener per group, and ONE members listener over everyone in
  // any of my groups, so a person who shares several groups with me is only tracked (and pinned) once.
  const groupIdsKey = state.groups.map((g) => g.id).sort().join(',');
  const memberKey = allMemberIds(state.groups).sort().join(',');
  // Gated on myUid: listeners started before sign-in completes are rejected by the rules.
  const authedUid = state.myUid;
  useEffect(() => {
    if (!groupIdsKey || !authedUid || DEMO_MODE) return;
    const unsubs = groupIdsKey.split(',').map((id) =>
      fb.subscribeGroup(
        id,
        (group) => {
          dispatch({ type: 'upsertGroup', group });
          set({ lastSyncedAt: Date.now() });
        },
        () => dispatch({ type: 'removeGroup', id }), // stale/denied group -> drop just that one
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [groupIdsKey, authedUid, set]);
  useEffect(() => {
    if (!memberKey || !authedUid || DEMO_MODE) return;
    return fb.subscribeMembers(memberKey.split(','), (all) =>
      set({ members: all.filter((m) => m.uid !== authedUid), lastSyncedAt: Date.now() }),
    );
  }, [memberKey, authedUid, set]);

  // 5. Alert polling while online.
  useEffect(() => {
    if (!state.isOnline) return;
    const tick = async () => {
      const me = stateRef.current.myLocation;
      if (!me || stateRef.current.activeAlert) return;
      const [first] = await alerts.checkAlerts(me);
      if (first) {
        set({ activeAlert: first });
        alerts.notifyAlert(first).catch(() => {});
      }
    };
    const id = setInterval(tick, alerts.POLL_INTERVAL_MS);
    tick();
    return () => clearInterval(id);
  }, [state.isOnline, set]);

  // 6. Persist offline snapshot whenever the important bits change.
  useEffect(() => {
    if (!state.hydrated) return;
    saveSnapshot({
      personalMeetingPlace: state.personalMeetingPlace,
      myUid: state.myUid,
      myName: state.myName,
      group: state.group,
      groups: state.groups,
      activeGroupId: state.activeGroupId,
      visibleGroupIds: state.visibleGroupIds,
      members: state.members,
      route: state.route,
      tiles: state.tiles,
    });
  }, [state.hydrated, state.personalMeetingPlace, state.myUid, state.myName, state.groups, state.activeGroupId, state.visibleGroupIds, state.members, state.route, state.tiles]);

  const actions = useMemo<AppActions>(() => {
    const s = () => stateRef.current;
    const updateGroup = (patch: Partial<Group>) => {
      const g = s().group;
      if (g) dispatch({ type: 'upsertGroup', group: { ...g, ...patch } });
    };
    const routeTo = async (target: Place) => {
      const isCurrent = beginRouteRequest();
      const { myLocation: from, route: cached, isOnline } = s();
      if (!from) {
        set({ routingLoading: false, routingMessage: 'Waiting for your GPS location.' });
        return;
      }
      const fallback = fallbackRoute(from, target, cached);
      set({ route: fallback, routeIsCached: !fallback.isStraightLine,
        routingLoading: isOnline, routingMessage: null });
      if (!isOnline) {
        set({ routingMessage: fallback.isStraightLine
          ? 'Offline — no saved walking route for this destination.' : 'Offline — showing saved walking route.' });
        return;
      }
      try {
        const route = await fetchWalkingRoute(from, target);
        if (isCurrent()) set({ route, routeIsCached: false, routingLoading: false });
      } catch {
        if (isCurrent()) set({ routingLoading: false, routingMessage: fallback.isStraightLine
          ? 'Walking route unavailable. Showing straight-line direction; tap Go to retry.'
          : 'Could not refresh route. Showing saved walking route; tap Go to retry.' });
      }
    };
    return {
      async setMeetingPlace(coord, name = 'Meeting place') {
        if (!(await canChangeMeetingPlace(s().isOnline)) || !s().isOnline) {
          Alert.alert('Meeting place locked offline', 'Reconnect to the internet to change the meeting place. Your saved location has not changed.');
          return;
        }
        const place: Place = { id: 'meet', name, coord, type: 'meeting' };
        const g = s().group;
        if (g) updateGroup({ meetingPlace: place });
        else set({ personalMeetingPlace: place });
        await routeTo(place);
        // Not awaited + caught: hangs offline, and a denied write must not be an unhandled rejection.
        if (g) fb.setMeetingPlace(g.id, place).catch((e) => console.warn('setMeetingPlace', e?.message));
      },
      async addSafeArea(coord, name) {
        const place: Place = { id: `safe-${Date.now()}`, name, coord, type: 'custom' };
        const g = s().group;
        if (!g) return;
        updateGroup({ safeAreas: [...g.safeAreas, place] });
        fb.addSafeArea(g.id, place).catch((e) => console.warn('addSafeArea', e?.message));
      },
      routeTo,
      async routeToBestTarget() {
        const { group, personalMeetingPlace, myLocation, activeAlert } = s();
        if (!myLocation) return;
        // During a disaster, pick a place that suits the hazard (e.g. not an open field in a tornado).
        const hazard = activeAlert?.hazard;
        const target = group
          ? hazard
            ? pickSafeTarget(hazard, myLocation, group)
            : group.meetingPlace ?? nearestPlace(myLocation, group.safeAreas)
          : hazard && !meetingPlaceOk(hazard)
            ? null
            : personalMeetingPlace;
        if (target) await routeTo(target);
      },
      async setStatus(status) {
        set({ myStatus: status });
        const uid = s().myUid;
        if (uid) fb.publishStatus(uid, status).catch((e) => console.warn('publishStatus', e?.message));
      },
      async setName(name) {
        set({ myName: name });
        const uid = s().myUid;
        if (uid) fb.saveProfile(uid, name).catch((e) => console.warn('saveProfile', e?.message));
      },
      async createGroup(name) {
        const uid = s().myUid;
        if (!uid) return false;
        const g = await fb.createGroup(uid, name).catch(() => null);
        if (g) dispatch({ type: 'upsertGroup', group: g, select: true });
        return !!g;
      },
      async joinGroup(code) {
        const uid = s().myUid;
        if (!uid) return false;
        const g = await fb.joinGroup(uid, code.trim().toUpperCase()).catch(() => null);
        if (g) dispatch({ type: 'upsertGroup', group: g, select: true });
        return !!g;
      },
      leaveGroup() {
        const { group, myUid } = s();
        if (!group) return;
        if (myUid && !DEMO_MODE) void fb.leaveGroup(myUid, group.id);
        dispatch({ type: 'removeGroup', id: group.id });
      },
      selectGroup(id) {
        set({ activeGroupId: id });
      },
      toggleGroupVisible(id) {
        const v = s().visibleGroupIds;
        set({ visibleGroupIds: v.includes(id) ? v.filter((x) => x !== id) : [...v, id] });
      },
      async triggerAlert(alert) {
        set({ activeAlert: alert });
        await alerts.notifyAlert(alert).catch(() => {});
      },
      dismissAlert() {
        set({ activeAlert: null });
      },
      setPreparedOffline(route, tiles) {
        set({ route, tiles, routeIsCached: false });
      },
      setTiles(tiles) {
        set({ tiles });
      },
    };
  }, [set, beginRouteRequest]);

  return <Ctx.Provider value={{ state, actions }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
