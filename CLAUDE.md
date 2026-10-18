# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

SafeHaven is a lightweight, offline-capable iOS emergency app (Expo / React Native / TypeScript, Firebase JS SDK) built by a 4-person team at DubHacks 2026. `docs/TEAM_PLAN.md` is the source of truth for who owns which files, task lists, checkpoints and the demo script. Read it before starting a task.

## Commands

```bash
npm install
npx expo start                 # dev server; scan QR with Expo Go on iPhone (press w for web)
npm run typecheck              # tsc --noEmit
npm test                       # jest (jest-expo preset)
npx jest src/lib/geo.test.ts   # single test file
npx jest -t "tile math"        # single test by name
npx expo install --check       # verify deps match the Expo SDK; run after adding any Expo package
```

Before merging: `npm run typecheck`, `npm test`, and open the app in Expo Go. There is no linter configured.

## Architecture

- **Entry:** `index.tsx` (package.json `main`) loads the saved appearance (Dark default / Light / Match phone, `src/lib/appearance.ts`) *before* lazily requiring expo-router's app, so `src/theme.ts` resolves colors from it. Don't import `@/theme` from `index.tsx` or `appearance.ts`. On Android, changing appearance needs an app restart.
- **Routing:** Expo Router (file-based). `app/_layout.tsx` wraps everything in `<AppProvider>` and a Stack; `app/(tabs)/` holds the Map (`index`), Group and Info (first aid) tabs; `alert.tsx` is a modal and `compass.tsx` a pushed screen.
- **State:** `src/state/AppContext.tsx` is the single store and the *only* place services are wired together. Screens call `useApp()` → `{ state, actions }` and never call services directly. It handles, in order: hydrate from the offline snapshot → connectivity → foreground location watch with throttled publish → live Firestore group/member subscriptions → alert polling while online → persist snapshot on change.
- **Offline-first:** `src/services/offline.ts` saves an `OfflineSnapshot` (group, members, route, tiles, name, uid) to AsyncStorage so a relaunch with zero network still shows the last-known world. Services must **never throw into the UI when offline**: catch and return a fallback (empty list, `straightLineRoute()`, `null`).
- **DEMO MODE:** when the `EXPO_PUBLIC_FIREBASE_*` vars in `.env` are blank (see `.env.example`), `DEMO_MODE` is true, Firebase calls are no-ops, and the app uses mock data around UW from `src/mocks/demo.ts`.
- **Services** (`src/services/`): `firebase.ts` (anonymous auth + Firestore; data model in its header comment and `firestore.rules`), `location.ts`, `routing.ts` (FOSSGIS/OSRM foot router, straight-line fallback), `tiles.ts` (offline map tile download, `EXPO_PUBLIC_TILE_URL_TEMPLATE`), `alerts.ts` (NWS + USGS feeds, local notifications), `connectivity.ts`.
- **Shared contracts:** `src/types.ts`. Geo coordinates are `LatLng {latitude, longitude}`; external feeds (OSRM, NWS GeoJSON) are `[lng, lat]` and must be flipped. Pure geo math lives in `src/lib/geo.ts` (the tested module).
- **Theme:** `src/theme.ts` exports `colors` and `statusColor`; shared UI lives in `src/components/`.
- `@/*` maps to `src/*` (tsconfig + jest `moduleNameMapper`).

## Team conventions

- Each file has an owner role (MAP / SYNC / ALERTS / UI; see the TEAM_PLAN code map, and `// [OWNER: ...]` headers). Stubs are marked `TODO [ROLE]` with their final signatures already in place.
- **Stay in your lane:** each teammate's role is set in their own `CLAUDE.local.md`. Don't edit files owned by another role (e.g. `AppContext.tsx`, `src/services/*`, another role's screens) without asking the user first. Instead, describe the exact change (file, function, diff) the user should request from that file's owner.
- `src/types.ts`, `src/state/AppContext.tsx` and `app/_layout.tsx` are shared: keep edits small and flag them so the user can tell teammates.
- "Lightweight" is the pitch: ask before adding any dependency; Expo modules and the Firebase JS SDK only, no UI kits.

## Gotchas

- **Expo SDK 57**, not 58: the App Store's Expo Go doesn't support SDK 58 yet. Don't upgrade.
- Icons: `import Ionicons from '@expo/vector-icons/Ionicons'`, never the barrel `{ Ionicons } from '@expo/vector-icons'` (+3 MB).
- Tests must `import { expect, test } from '@jest/globals'` (TS 6 doesn't add Jest globals).
- `package.json` pins `react-dom` via `overrides`; removing it makes `npm install` fail with ERESOLVE.
- `npx expo start` may rewrite `tsconfig.json` (drops `.expo/types` / `expo-env.d.ts` from `include`); don't commit that change by accident.
- Background location and remote push don't work in Expo Go; they need an EAS dev build.
