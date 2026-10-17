# SafeHaven 🧭 — DubHacks 2026

Lightweight iOS emergency app: disaster alerts → directions to safety, family location sharing, a shared meeting place, and **guidance that keeps working with no signal**.

Built with Expo (React Native + TypeScript) so we can develop on Windows and test on iPhones with **Expo Go**.

## Quick start

```bash
# 1. Node 20+ (https://nodejs.org) and the latest Expo Go from the App Store, then:
npm install
npx expo install --check    # should say "Dependencies are up to date" (Expo SDK 58)
cp .env.example .env        # optional — leave blank for DEMO MODE
npx expo start              # scan the QR with the iPhone Camera → opens in Expo Go
```

```bash
npm test          # geo math unit tests
npm run typecheck
```

**DEMO MODE:** with no Firebase keys in `.env`, the app loads a mock family and safe areas around UW (`src/mocks/demo.ts`). Everyone can build UI and map features before the backend exists.

## How the code is laid out

```
app/                       expo-router screens
  (tabs)/index.tsx         Map ................................. MAP
  (tabs)/group.tsx         Group / status / create-join ........ UI
  (tabs)/info.tsx          First aid (stretch) ................. UI
  alert.tsx                Alert modal → route to safety ....... ALERTS
  compass.tsx              Offline compass ..................... MAP
src/
  types.ts                 ⚠️ SHARED CONTRACTS (see below)
  state/AppContext.tsx     Single store: hydrate, location, sync, alerts, snapshot persistence
  lib/geo.ts               distance, bearing, point-in-polygon, tile math (+ tests)
  services/
    firebase.ts            Auth + Firestore ....................... SYNC
    location.ts            GPS, heading, publish throttle .......... SYNC
    offline.ts             Snapshot to disk ........................ MAP
    tiles.ts               Offline map tile download ............... MAP
    routing.ts             Walking route (online → cached) ......... MAP
    alerts.ts              NWS + USGS + notifications .............. ALERTS
    connectivity.ts        Online/offline
  components/              Shared UI ............................... UI
  mocks/demo.ts            Demo data + simulated alert
firestore.rules            ............................................ SYNC
```

Search for `TODO [MAP]`, `TODO [SYNC]`, `TODO [ALERTS]` or `TODO [UI]` to find your work. Every stub already has its final signature and implementation hints, and the app runs end-to-end on mock/stub behavior today.

## Ownership

| Area | Owner | First milestones |
|---|---|---|
| **MAP** — map, offline tiles, routing, compass | _name_ | real walking route in `routing.ts` → tile downloader in `tiles.ts` → airplane-mode test |
| **SYNC** — Firebase, groups, location sync | _name_ | Firebase project + `.env` → `createGroup`/`joinGroup` → `subscribeGroup`/`subscribeMembers` → `publishLocation` |
| **ALERTS** — feeds, notifications, safe areas | _name_ | `fetchNwsAlerts` → `fetchUsgsQuakes` → real shelter data for safe areas → EAS dev build (background location + push) |
| **UI** — screens, onboarding, demo, stretch | _name_ | onboarding (name + permissions) → group screen polish → first-aid content → AI hazard photo (stretch) |

## Contracts (read before editing shared files)

- `src/types.ts` is the agreement between all four areas. **Post in team chat before changing it** and update every usage in the same PR.
- `src/state/AppContext.tsx` is the only place services are wired together. Screens call `useApp()` and never import Firebase directly.
- Services must **never throw into the UI when offline**. Catch the error and return a fallback (empty list, straight-line route, `null`).

## Git workflow

- `main` must always run. Make a branch per task: `map/tiles`, `sync/groups`, `alerts/nws`, `ui/onboarding`.
- Open small PRs into `main` and get one teammate to glance at each. Pull `main` often.
- Don't commit `.env`. Share keys in team chat.

## Lightweight rules (our pitch vs Life360)

- No UI kits, no analytics, no extra map SDKs. Ask before adding any dependency.
- GPS only while the app is open. Firestore writes are throttled to >100 m moved or 5 minutes passed (`location.ts`).
- Offline tiles are opt-in and limited to a ~3 km radius.

## Expo Go vs dev build

Everything except **background location** and **remote push** works in Expo Go. For those two: `npm i -g eas-cli && eas build --profile development --platform ios`, which needs an Apple Developer account ($99/year). If we don't have one, we demo with foreground tracking only.

## Demo script

1. Create a family group and have a second phone join it with the invite code.
2. Long-press the map to set the meeting place. A route appears.
3. Tap **Simulate**. The alert modal opens; tap "Go to meeting place".
4. Turn on airplane mode, then kill and relaunch the app. The map tiles, meeting place, route, compass and last-known family pins are all still there.

## Notes

- **Icons:** import `Ionicons from '@expo/vector-icons/Ionicons'`, not `{ Ionicons } from '@expo/vector-icons'`. The barrel import bundles every icon font (+3 MB).
- **Tests:** TypeScript 6 doesn't add Jest globals automatically, so import them: `import { expect, test } from '@jest/globals'`.
- `package.json` pins `react-dom` via `overrides` to match Expo's React version. Without it, `npm install` fails with ERESOLVE.
