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
import { fetchWalkingRoute } from '@/services/routing';
import type { Group, HazardAlert, LatLng, Member, MemberStatus, Place, Route, TileRegion } from '@/types';

export const DEMO_MODE = !fb.isFirebaseConfigured;

export interface AppState {
  hydrated: boolean;
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
  createGroup(name: string): Promise<void>;
  joinGroup(code: string): Promise<void>;
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
  const lastPublished = useRef<{ coord: LatLng; ts: number } | null>(null);

  // 1. Hydrate from disk first so offline launch shows the last-known world.
  useEffect(() => {
    (async () => {
      const snap = await loadSnapshot();
      const uid = await fb.ensureSignedIn().catch(() => snap?.myUid ?? null);
      dispatch({
        type: 'hydrate',
        patch: {
          myUid: uid,
          myName: snap?.myName ?? 'Me',
          group: snap?.group ?? (DEMO_MODE ? DEMO_GROUP : null),
          members: snap?.members ?? (DEMO_MODE ? DEMO_MEMBERS : []),
          route: snap?.route ?? null,
          tiles: snap?.tiles ?? null,
          lastSyncedAt: snap?.savedAt ?? null,
        },
      });
    })();
  }, []);

  // 2. Connectivity.
  useEffect(() => subscribeOnline((isOnline) => set({ isOnline })), [set]);

  // 3. Foreground location + throttled publish.
  useEffect(() => {
    let stop: (() => void) | undefined;
    (async () => {
      if (!(await loc.requestForegroundPermission())) {
        if (DEMO_MODE) set({ myLocation: UW_CENTER });
        return;
      }
      stop = await loc.startForegroundWatch((coord) => {
        set({ myLocation: coord });
        const uid = stateRef.current.myUid;
        if (uid && stateRef.current.isOnline && loc.shouldPublish(lastPublished.current, coord)) {
          lastPublished.current = { coord, ts: Date.now() };
          fb.publishLocation(uid, coord).catch(() => {});
        }
      });
    })();
    return () => stop?.();
  }, [set]);

  // 4. Live group + members (no-op in demo mode until [SYNC] implements firebase.ts).
  const groupId = state.group?.id;
  const memberKey = state.group?.memberIds.join(',') ?? '';
  useEffect(() => {
    if (!groupId || DEMO_MODE) return;
    return fb.subscribeGroup(groupId, (group) => set({ group, lastSyncedAt: Date.now() }));
  }, [groupId, set]);
  useEffect(() => {
    if (!memberKey || DEMO_MODE) return;
    const uid = stateRef.current.myUid;
    return fb.subscribeMembers(memberKey.split(','), (all) =>
      set({ members: all.filter((m) => m.uid !== uid), lastSyncedAt: Date.now() }),
    );
  }, [memberKey, set]);

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
      const from = s().myLocation;
      if (!from) return;
      // Offline: keep the cached route if it goes to the same place; otherwise straight line.
      const route = await fetchWalkingRoute(from, target);
      set({ route });
    };
    return {
      async setMeetingPlace(coord, name = 'Meeting place') {
        const place: Place = { id: 'meet', name, coord, type: 'meeting' };
        updateGroup({ meetingPlace: place });
        const g = s().group;
        if (g) await fb.setMeetingPlace(g.id, place);
        await routeTo(place);
      },
      async addSafeArea(coord, name) {
        const place: Place = { id: `safe-${Date.now()}`, name, coord, type: 'custom' };
        const g = s().group;
        if (!g) return;
        updateGroup({ safeAreas: [...g.safeAreas, place] });
        await fb.addSafeArea(g.id, place);
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
        if (uid) await fb.publishStatus(uid, status);
      },
      async setName(name) {
        set({ myName: name });
        const uid = s().myUid;
        if (uid) await fb.saveProfile(uid, name);
      },
      async createGroup(name) {
        const uid = s().myUid;
        if (!uid) return;
        const g = await fb.createGroup(uid, name);
        if (g) set({ group: g });
      },
      async joinGroup(code) {
        const uid = s().myUid;
        if (!uid) return;
        const g = await fb.joinGroup(uid, code.trim().toUpperCase());
        if (g) set({ group: g });
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
  }, [set]);

  return <Ctx.Provider value={{ state, actions }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
