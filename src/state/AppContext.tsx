// Single app store shared by every screen. Services write into it; screens read from it.
// Keeps an offline snapshot on disk so the app is useful with zero network after relaunch.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { nearestPlace } from '@/lib/geo';
import { DEMO_GROUP, DEMO_MEMBERS, UW_CENTER } from '@/mocks/demo';
import * as alerts from '@/services/alerts';
import { subscribeOnline } from '@/services/connectivity';
import * as fb from '@/services/firebase';
import * as loc from '@/services/location';
import { loadSnapshot, saveSnapshot } from '@/services/offline';
import { createRouteRequestGuard, fallbackRoute, fetchWalkingRoute } from '@/services/routing';
import type { Group, HazardAlert, LatLng, Member, MemberStatus, Place, Route, TileRegion } from '@/types';

export const DEMO_MODE = !fb.isFirebaseConfigured;

export interface AppState {
  hydrated: boolean;
  routingLoading: boolean;
  routingMessage: string | null;
  routeIsCached: boolean;
  myUid: string | null;
  myName: string;
  myLocation: LatLng | null;
  myStatus: MemberStatus;
  group: Group | null;
  members: Member[];
  route: Route | null;
  tiles: TileRegion | null;
  activeAlert: HazardAlert | null;
  isOnline: boolean;
  lastSyncedAt: number | null;
}

type Action =
  | { type: 'hydrate'; patch: Partial<AppState> }
  | { type: 'set'; patch: Partial<AppState> };

const initial: AppState = {
  hydrated: false,
  routingLoading: false,
  routingMessage: null,
  routeIsCached: false,
  myUid: null,
  myName: 'Me',
  myLocation: null,
  myStatus: 'unknown',
  group: null,
  members: [],
  route: null,
  tiles: null,
  activeAlert: null,
  isOnline: true,
  lastSyncedAt: null,
};

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'hydrate':
      return { ...s, ...a.patch, hydrated: true };
    case 'set':
      return { ...s, ...a.patch };
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
  leaveGroup(): void;
  triggerAlert(alert: HazardAlert): Promise<void>;
  dismissAlert(): void;
  setTiles(tiles: TileRegion | null): void;
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
      // A saved demo group must never shadow the real join/create screen when Firebase is configured.
      if (!DEMO_MODE && snap?.group?.id === 'demo-group') snap = { ...snap, group: null, members: [] };
      // Only trust a uid that actually signed in; a stale cached uid means unauthenticated requests.
      const uid = await fb.ensureSignedIn().catch(() => null);
      dispatch({
        type: 'hydrate',
        patch: {
          myUid: uid,
          myName: snap?.myName ?? 'Me',
          group: snap?.group ?? (DEMO_MODE ? DEMO_GROUP : null),
          members: snap?.members ?? (DEMO_MODE ? DEMO_MEMBERS : []),
          route: snap?.route ?? null,
          routeIsCached: !!snap?.route,
          tiles: snap?.tiles ?? null,
          lastSyncedAt: snap?.savedAt ?? null,
        },
      });

      // No saved group (fresh launch, cleared storage): ask Firestore if we already belong to one.
      if (!DEMO_MODE && uid && !snap?.group) {
        const g = await fb.findMyGroup(uid);
        if (g && !stateRef.current.group) dispatch({ type: 'set', patch: { group: g } });
      }
    })();
  }, []);

  // 2. Connectivity.
  useEffect(() => subscribeOnline((isOnline) => set({ isOnline })), [set]);

  // 2b. If sign-in failed at launch (offline / flaky Wi-Fi), retry when we're back online.
  useEffect(() => {
    if (!state.hydrated || state.myUid || !state.isOnline || DEMO_MODE) return;
    fb.ensureSignedIn().then((uid) => set({ myUid: uid })).catch(() => {});
  }, [state.hydrated, state.myUid, state.isOnline, set]);

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

  // 4. Live group + members (no-op in demo mode until [SYNC] implements firebase.ts).
  const groupId = state.group?.id;
  const memberKey = state.group?.memberIds.join(',') ?? '';
  // Gated on myUid: listeners started before sign-in completes are rejected by the rules.
  const authedUid = state.myUid;
  useEffect(() => {
    if (!groupId || !authedUid || DEMO_MODE) return;
    return fb.subscribeGroup(
      groupId,
      (group) => set({ group, lastSyncedAt: Date.now() }),
      () => set({ group: null, members: [], route: null }), // stale/denied group -> back to join/create
    );
  }, [groupId, authedUid, set]);
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
      myUid: state.myUid,
      myName: state.myName,
      group: state.group,
      members: state.members,
      route: state.route,
      tiles: state.tiles,
    });
  }, [state.hydrated, state.myUid, state.myName, state.group, state.members, state.route, state.tiles]);

  const actions = useMemo<AppActions>(() => {
    const s = () => stateRef.current;
    const updateGroup = (patch: Partial<Group>) => {
      const g = s().group;
      if (g) set({ group: { ...g, ...patch } });
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
        const place: Place = { id: 'meet', name, coord, type: 'meeting' };
        updateGroup({ meetingPlace: place });
        const g = s().group;
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
        const { group, myLocation } = s();
        if (!group || !myLocation) return;
        const target = group.meetingPlace ?? nearestPlace(myLocation, group.safeAreas);
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
        if (g) set({ group: g });
        return !!g;
      },
      async joinGroup(code) {
        const uid = s().myUid;
        if (!uid) return false;
        const g = await fb.joinGroup(uid, code.trim().toUpperCase()).catch(() => null);
        if (g) set({ group: g });
        return !!g;
      },
      leaveGroup() {
        set({ group: null, members: [], route: null });
      },
      async triggerAlert(alert) {
        set({ activeAlert: alert });
        await alerts.notifyAlert(alert).catch(() => {});
      },
      dismissAlert() {
        set({ activeAlert: null });
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
