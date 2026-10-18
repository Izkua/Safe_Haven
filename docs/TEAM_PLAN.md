# SafeHaven — Team Plan

The plan has one section per member, written for a 24-hour hack. Hours count from the start of hacking (**H0**). Every member works on their own branch and merges small PRs into `main`. `main` must always run in Expo Go.

> **Golden rule:** finish the **Core** before touching the **Stretch** work. A working offline map with a meeting place beats a half-built AI feature.

## Who's who

| Role | Member | Owns |
|---|---|---|
| 🗺️ **MAP** | _name_ | map, offline tiles, routing, compass |
| 🔗 **SYNC** | _name_ | Firebase, groups, live location |
| 🚨 **ALERTS** | _name_ | disaster feeds, notifications, safe areas, EAS build |
| 🎨 **UI** | _name_ | onboarding, screens, first aid, demo + pitch |

Search the code for `npTODO [MAP]`, `TODO [SYNC]`, `TODO [ALERTS]` or `TODO [UI]` to find your stubs. Each one already has its final signature and hints. With no `.env`, the app runs in **DEMO MODE** on mock data around UW (`src/mocks/demo.ts`).

---

## Team checkpoints

| When | Checkpoint | Who checks |
|---|---|---|
| **H0–H1** | Everyone: `npm install` → `npx expo start` → app opens in Expo Go in DEMO MODE. Fill in names in **Who's who** above. | All |
| **H3** | Firebase project live, `.env` shared in team chat, anonymous sign-in works. | SYNC |
| **H6** | **Integration 1:** two phones join the same real group and see each other's pins. | SYNC + MAP |
| **H10** | **Integration 2:** a real (or simulated) alert opens the alert screen, and "Go to meeting place" draws a real walking route. | ALERTS + MAP |
| **H14** | **Integration 3 (the money test):** airplane mode → kill the app → relaunch. The map tiles, meeting place, route, compass and stale pins all show. | MAP (+ all) |
| **H18** | **Feature freeze.** Only bug fixes and polish after this point. Stretch work merges only if it's already done and doesn't break anything. | All |
| **H20** | Full demo rehearsal on two phones, twice. Record a backup video. | UI (runs it) |
| **H22** | Devpost write-up + slides done. | UI + all |

---

## Gaps nobody owns yet (assigned here)

These came out of reviewing the framework. Each one is listed in the owner's task list below.

| Gap | Owner |
|---|---|
| `requestNotificationPermission()` is never called, so alerts can't notify | UI (onboarding) |
| `actions.setName()` and `actions.addSafeArea()` have no UI | UI |
| Fresh install / new phone can't find the group the user is already in | SYNC |
| Tapping a notification doesn't open the alert screen | ALERTS |
| A dismissed NWS alert will re-fire on the next 5-minute poll | ALERTS |
| `routeTo()` while offline replaces the good cached route with a straight line | MAP |

---

## 🗺️ MAP — map, offline, routing, compass

**Mission:** the user can always see where to go, **even with zero signal.** This is the core of the pitch.

**Files you own:** `app/(tabs)/index.tsx`, `app/compass.tsx`, `src/services/routing.ts`, `src/services/tiles.ts`, `src/services/offline.ts`
**Depends on:** SYNC for real group data (until H6, use DEMO MODE).
**Others depend on you for:** `routeTo()` producing a real route (ALERTS' alert screen uses it).

### Core tasks
1. **Real walking route** (`routing.ts`, ~1.5h)
   - Implement `fetchWalkingRoute()` with the FOSSGIS foot router (URL is in the file).
   - Convert `geometry.coordinates` (`[lng, lat]`) to `LatLng[]`. Set `isStraightLine: false`.
   - Add a 6 s timeout (`AbortController`). On **any** failure, return `straightLineRoute()`.
   - ✅ *Done when:* long-pressing the map draws a solid route that follows streets.
2. **Don't throw away a good route offline** (`AppContext.tsx` → `routeTo`, ~30m)
   - If offline and `state.route?.targetId === target.id`, keep the cached route. Only fall back to a straight line for a different target.
   - ✅ *Done when:* in airplane mode, tapping "Go" keeps the street route.
3. **Offline tile downloader** (`tiles.ts`, ~3h)
   - Get a free MapTiler key, put it in `.env` → `EXPO_PUBLIC_TILE_URL_TEMPLATE`.
   - Implement `downloadRegion()`: make directories, download about 6 tiles in parallel, skip tiles that already exist, report progress, return a `TileRegion`.
   - Download around **both** the user and the meeting place (call it twice, or merge the two tile sets).
   - ✅ *Done when:* the "Offline map" button shows progress and ends with "Saved". In airplane mode the map still shows streets through `<LocalTile>`.
   - ⚠️ If `LocalTile` misbehaves on iOS, tell the team by **H12**. The fallback is MapLibre, which needs the EAS dev build.
4. **Offline UX on the map** (~1.5h)
   - Grey out stale member pins (already 45% opacity past 15 min) and show "seen X min ago" in the callout.
   - Center or re-center button: fit the map to me + meeting place + members (`mapRef.fitToCoordinates`).
   - Draw safe areas with distinct icons (custom `<Marker>` children instead of `pinColor`).
5. **Compass polish** (`compass.tsx`, ~1h)
   - Smooth the heading (ignore changes under 3°) so the arrow doesn't jitter.
   - Let the user switch the target between the meeting place and the nearest safe area.
   - Vibrate on arrival (`expo-haptics` is tiny, so it's OK to add).
6. **Airplane-mode test**: own the **H14 checkpoint**. Write down what breaks and fix it.

### Stretch
- Automatically download tiles when the user joins a group or sets a meeting place, but only on Wi-Fi.
- Turn-by-turn style hint ("next: turn left on 15th Ave") from the OSRM `steps`.

---

## 🔗 SYNC — Firebase, groups, live location

**Mission:** family members see each other in real time, and the app never crashes when the network drops.

**Files you own:** `src/services/firebase.ts`, `src/services/location.ts`, `firestore.rules`
**Others depend on you for:** the Firebase `.env` by **H3**, and real group data by **H6**. Post the `.env` in team chat, never in git.

### Core tasks
1. **Firebase project** (~45m, by H3)
   - Create the project. Enable **Anonymous** auth and **Firestore** (production mode, `us-west1`).
   - Register a Web app and copy the config into `.env`. Share it with the team.
   - Deploy `firestore.rules`, either by pasting them into the console Rules tab or with `firebase deploy --only firestore:rules`.
   - ✅ *Done when:* the DEMO MODE badge disappears and the Firebase console shows an anonymous user.
2. **Profile + groups** (~2.5h)
   - `saveProfile`: `setDoc(doc(db,'users',uid), { name, status:'unknown' }, { merge:true })`.
   - `createGroup`: random 6-char code from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no O/0/I/1), `addDoc(collection(db,'groups'), {...})`, return a `Group` with `id`.
   - `joinGroup`: `query(groups, where('inviteCode','==',code), limit(1))`, then `updateDoc(..., { memberIds: arrayUnion(uid) })`. Also add the group ID to the user's `groupIds`.
   - ✅ *Done when:* phone A creates a group and phone B joins it by code.
3. **Live listeners** (~2h, by H6)
   - `subscribeGroup`: `onSnapshot(doc(db,'groups',id), snap => cb({ id: snap.id, ...snap.data() }))`.
   - `subscribeMembers`: `query(users, where(documentId(),'in', chunk))`. Chunk to at most 30 IDs. Map `lastLocation` → `location` and `locationTs`.
   - Pass an error callback to every `onSnapshot` that **logs and doesn't throw**. Offline is normal.
   - ✅ *Done when:* **H6 checkpoint**, with pins moving on both phones.
4. **Writes** (~1h)
   - `publishLocation`, `publishStatus`, `setMeetingPlace`, `addSafeArea`. These are one `updateDoc` each, wrapped in try/catch.
   - Check that the throttle works: Firestore usage should show roughly one write per 100 m or 5 min, not per second.
5. **Restore my group on a fresh install** (~45m), a new gap
   - Add `findMyGroup(uid): Promise<Group | null>` (`where('memberIds','array-contains',uid)`).
   - In `AppContext` hydrate, if there's no snapshot group, call it. Coordinate this with MAP, since `AppContext` is shared.
   - Note: an anonymous uid is lost when the app is deleted. That's fine for the hackathon; say "accounts" in the pitch as future work.
6. **Tighten the rules** (~45m)
   - Remove the broad `allow list` on groups. Restrict listing to invite-code queries, or use a `inviteCodes/{code} → gid` lookup doc.
   - Make `users` readable only by people who share a group (or keep it open and call it out as a known issue).

### Stretch
- **Emergency-mode background tracking.** Steps are in the `location.ts` TODO, and it needs the EAS dev build from ALERTS.
- Push the "Need help" status to the group: store each user's Expo push token, then POST to `https://exp.host/--/api/v2/push/send` from a small Cloud Function (or from the client for the demo).

---

## 🚨 ALERTS — disaster feeds, notifications, safe areas

**Mission:** when a disaster hits, the phone warns you **and** tells you where to go in one tap.

**Files you own:** `src/services/alerts.ts`, `app/alert.tsx`, `src/mocks/demo.ts` (safe-area data)
**Depends on:** MAP's `routeTo()` for the "Go to…" buttons, which works today with straight lines.

### Core tasks
1. **NWS alerts** (~2h)
   - Implement `fetchNwsAlerts()` with the `User-Agent` header (it's required, or you get a 403).
   - Map severity `Extreme/Severe/Moderate/Minor` → our enum. `geometry` can be `null` (zone-based alerts). If so, use `areas: []`, and `isUserAffected` returns true because NWS already filtered by point.
   - Polygon coordinates are `[lng, lat]`, so flip them into `LatLng`.
   - ✅ *Done when:* a test call with a point that has an active alert (pick one from `https://api.weather.gov/alerts/active`) returns parsed `HazardAlert`s. Add a Jest test with a saved sample JSON in `src/services/__fixtures__/`.
2. **USGS earthquakes** (~1.5h)
   - Implement `fetchUsgsQuakes()`. Filter by `distanceM` within `QUAKE_RADIUS_KM`. Map magnitude to severity (rules are in the file).
   - ✅ *Done when:* a Jest test with a sample feed passes.
3. **Don't nag** (~45m), a new gap
   - Keep `seenAlertIds` (persist it in AsyncStorage). `checkAlerts` skips IDs already seen or dismissed.
4. **Notification tap → alert screen** (~45m), a new gap
   - In `app/_layout.tsx`: `Notifications.addNotificationResponseReceivedListener(() => router.push('/alert'))`. Also handle `getLastNotificationResponseAsync()` for a cold start.
5. **Real safe areas** (~2h)
   - Seed shelters, hospitals and open areas for the UW / Seattle demo area. Try the FEMA open-shelters feed. If it's empty or not reachable, hand-curate 8–10 places with real coordinates.
   - Pick the alert screen's "nearest safe area" by alert type: earthquake → open area, flood → higher ground or shelter, fire → away from the alert polygon.
6. **Alert screen polish** (`app/alert.tsx`, ~1h)
   - Big severity color band, time since issued, and the source ("National Weather Service").
   - Show the distance to each "Go to…" target.

### Stretch
- **EAS dev build** (owner of the build, ~1.5h incl. waiting): `eas build --profile development --platform ios`. Needs an Apple Developer account. Start by **H12** if we're doing it, because builds queue.
- A background fetch that checks alerts while the app is closed (needs the dev build).

---

## 🎨 UI — screens, onboarding, demo, stretch features

**Mission:** a stranger can pick up the phone and get to safety without help. You also own the demo and the pitch.

**Files you own:** `app/(tabs)/group.tsx`, `app/(tabs)/info.tsx`, `src/components/*`, `src/theme.ts`, new `app/onboarding.tsx`

### Core tasks
1. **Onboarding** (`app/onboarding.tsx`, ~2h), a new gap
   - Screens: welcome → "What's your name?" (calls `actions.setName`) → location permission explainer → notification permission (calls `requestNotificationPermission()` from `alerts.ts`) → create/join group.
   - Show it only once (an `onboarded` flag in AsyncStorage). Redirect from `app/_layout.tsx`.
   - ✅ *Done when:* a fresh install walks through onboarding and lands on the map in a group.
2. **Group screen** (~2h)
   - Share the invite code with the iOS share sheet (`Share.share`, built into React Native).
   - Rename the meeting place. "Add safe area here" (calls `actions.addSafeArea` with the current location).
   - Sort members so "need help" comes first, then by last seen.
3. **Emergency-first visual pass** (~2h)
   - Large tap targets (at least 48pt) and high contrast. Must work in light **and** dark mode (the current theme is dark only, so pick one or add both).
   - The "Need help" button should be impossible to miss on the map screen too.
4. **First-aid cards** (`info.tsx`, ~1.5h)
   - Move the content to `src/content/firstAid.json`. Write CPR, choking, severe bleeding, burns, shock and an earthquake checklist.
   - Use reputable sources (American Red Cross / AHA) and add a "Not a substitute for 911" line.
   - Bundled in the app, so it works offline.
5. **Demo + pitch** (H18–H22)
   - Own the **Demo script** at the bottom of this file. Run the H20 rehearsals. Record a backup video.
   - Write the Devpost: problem (heavy apps, dead networks), what we built, the offline story, the size and battery numbers (get IPA/bundle size from ALERTS or MAP).

### Stretch (only after H14 checkpoint passes)
- **AI hazard photo:** `expo-image-picker` → a small serverless endpoint (Firebase Cloud Function or Vercel) → a vision LLM such as Claude → JSON `{ hazards[], actions[] }`. Keep the API key on the server, never in the app. Online only; show "needs connection" when offline.
- **Multiple groups** (family vs. roommates): a group switcher at the top of the Group tab. `AppContext` currently holds one group, so coordinate that change with SYNC.

---

## Working agreements

- **Branches:** `map/routing`, `sync/groups`, `alerts/nws`, `ui/onboarding`, and so on. One PR per task. Get one teammate to glance at it before merging.
- **Shared files** (`src/types.ts`, `src/state/AppContext.tsx`, `app/_layout.tsx`): post in chat before editing, keep the change small, and merge quickly so others can pull it.
- **Before every merge:** run `npm run typecheck` and `npm test`, and open the app in Expo Go.
- **Stuck for more than 30 minutes?** Say so in chat. Swap or pair; don't sink hours.
- **Ask before adding any dependency.** "Lightweight" is our pitch.

## Code map

```
app/(tabs)/index.tsx      Map ............................ MAP
app/(tabs)/group.tsx      Group / status / create-join ... UI
app/(tabs)/info.tsx       First aid ...................... UI
app/alert.tsx             Alert modal → route to safety .. ALERTS
app/compass.tsx           Offline compass ................ MAP
src/types.ts              ⚠️ shared contracts: announce changes
src/state/AppContext.tsx  the one place services are wired together (screens use useApp())
src/lib/geo.ts            distance, bearing, point-in-polygon, tile math (+ tests)
src/services/firebase.ts, location.ts ............... SYNC
src/services/routing.ts, tiles.ts, offline.ts ....... MAP
src/services/alerts.ts .............................. ALERTS
firestore.rules ..................................... SYNC
```

Services must **never throw into the UI when offline**. Catch the error and return a fallback (empty list, straight-line route, `null`).

## Gotchas

- **Icons:** `import Ionicons from '@expo/vector-icons/Ionicons'`, not `{ Ionicons } from '@expo/vector-icons'`. The barrel import bundles every icon font (+3 MB).
- **Tests:** TypeScript 6 doesn't add Jest globals automatically, so `import { expect, test } from '@jest/globals'`.
- `package.json` pins `react-dom` via `overrides`. Don't remove it, or `npm install` fails with ERESOLVE.
- **Expo Go runs the latest SDK only** (we're on SDK 58). Run `npx expo install --check` after adding any Expo package.
- Background location and remote push **don't work in Expo Go**. They need the EAS dev build (ALERTS).

## Demo script

1. Phone A creates a family group. Phone B joins it with the invite code.
2. Long-press the map to set the meeting place. A street route appears.
3. Tap **Simulate**. The alert opens; tap "Go to meeting place".
4. Turn on airplane mode, then kill and relaunch the app. The map tiles, meeting place, route, compass and last-known family pins are all still there.
5. On phone B, tap "Need help". Phone A shows the red pin (and gets a push, if the dev build is done).
