# SafeHaven

**A lightweight iOS emergency app that keeps your people together when a disaster hits, even with no signal. Built at DubHacks 2026.**

SafeHaven warns you about disasters near you, tells you what to do, routes you on foot to your group's meeting point or a safe area, and shows where everyone in your group is and whether they're safe.

---

## Why SafeHaven?

Family-tracking apps like Life360 are big, track you around the clock, and are built for everyday use. In a disaster they tend to stop helping once the cell network goes down, which is exactly when you need them.

SafeHaven is built for that moment:

- **Light:** no account to create, no background tracking, no ads. Location is shared only while the app is open, and at most every 20 m or 60 s.
- **Focused:** every screen is about one question: *are my people safe, and where do we meet?*
- **Offline-capable:** the last known map, your group, the meeting point, your route, a compass and first-aid guides all keep working without a signal.

---

## What it does

### Disaster alerts
- Checks the **National Weather Service** (weather alerts) and **USGS** (earthquakes, magnitude 4+ within 150 km) for your location.
- An alert opens a full-screen warning that escalates with severity: an amber **watch**, a red **warning**, or a full red **emergency**. It shows the hazard-specific steps for what to do right now.
- One tap routes you to the best place for that hazard (for example, not an open field in a tornado) and switches to the map with you and the destination both in view.

### Groups and live locations
- **Create or join groups** with a 6-character invite code, and be in several at once (family, roommates…).
- See everyone's **live location** on the map, with their initial or profile photo, in a color unique to them.
- One-tap **I'm safe** or **I need help**. "Needs help" puts a red banner on everyone's map. Tapping it frames you and that person and routes you to them, and the route **follows them as they move**.
- Tap a member to see their photo, status and distance, and to **call or text** them if they've shared a number.

### Meeting points
- Each group has its own **meeting point**, in that group's color. Set it by **holding a spot on the map**, by **typing an address**, or with **your current location**.
- Everyone sees **who set it and when**, gets a notification when someone moves it (with the new address), and anyone routed there is re-routed automatically.
- A meeting point **too far to walk to** (more than 40 km) is refused instead of routed.

### Walking routes
- Walking routes come from OpenStreetMap data, drawn like Apple Maps. If the route service is unreachable, a straight-line direction is shown instead.
- The **compass** points to your destination with GPS alone, no signal needed.

### Disaster Havens and drills
- Save a **haven for each type of disaster** per group (for example, high ground for a flood) without changing your everyday meeting point.
- Run a **practice drill**: the whole group gets the same warning screen as a real alert, marked as a drill.

### Announcements
- Send a short **announcement** to one or more of your groups. It stays as a banner until dismissed, and you can see who has seen it.

### Offline
- **Offline Readiness** checks and saves what you need without a signal: your group, its members, the meeting point and a walking route.
- After a restart with no network, the app still shows the last known map, group and route.

### First aid
- Step-by-step guides (CPR, choking) and what to do in each type of disaster, bundled in the app so they work without a signal.

### Settings
- Change your name, profile photo and phone number; see whether location and alerts are on, with a shortcut to turn them on; switch between **Dark**, **Light** or **Match phone**.

---

## Honest limits

These are the gaps we know about:

- **Alerts are checked every 5 minutes, and only while the app is open.** Real alerts aren't yet sent to the whole group the way drills are, and there are no push notifications to a closed app.
- **No background location.** Your position is shared only while SafeHaven is open.
- **Walking routes come from a free demo server** ([FOSSGIS](https://routing.openstreetmap.de/about.html)). A public release would need a production routing service. Routes don't avoid hazards.
- **SafeHaven doesn't replace official alerts** (Wireless Emergency Alerts) or 911. Always follow local officials.

---

## Tech stack

| Layer | Choice |
|---|---|
| App | [Expo](https://expo.dev/) SDK 57 (React Native), [Expo Router](https://docs.expo.dev/router/introduction/) |
| Language | TypeScript |
| Backend / realtime | Firebase JS SDK: anonymous auth + Firestore |
| Map | `react-native-maps` (Apple Maps on iOS) |
| Data | NWS and USGS feeds, OpenStreetMap / FOSSGIS walking routes, Apple's built-in geocoder |
| Target | iOS (Android works in Expo Go) |

**Why Expo?** The team develops on Windows and tests on iPhones; Expo lets us build iOS apps without a Mac. To keep the app small we use Expo modules and the Firebase JS SDK only, with no UI kits or heavy libraries. Every new dependency has to justify its size.

---

## Getting started

### You'll need
- [Node.js](https://nodejs.org/) (LTS)
- An iPhone with **Expo Go** from the App Store
- *(Optional)* a Firebase project. Without one, the app runs in **demo mode** with sample data around the UW campus.

### Run it

```bash
git clone https://github.com/Izkua/Safe_Haven.git
cd Safe_Haven
npm install
cp .env.example .env        # leave the values blank for demo mode, or add your Firebase web config
npx expo start --go -c      # --go: open in Expo Go; -c: clear the cache
```

Scan the QR code with your iPhone's camera.

> **Why `--go`?** The project includes `expo-dev-client` for EAS development builds. Without `--go`, `npx expo start` assumes a development build, and Expo Go shows errors like `Cannot find native module 'ExpoAsset'`.

### Firebase
Copy your Firebase **web app** config into `.env` (see `.env.example`), and deploy the security rules in `firestore.rules`. `.env` is git-ignored: never commit it.

### Checks
```bash
npm run typecheck   # TypeScript
npm test            # Jest unit tests
```

---

## Project layout

```
app/                Screens (Expo Router, file-based)
  (tabs)/           Map, Group and Announcements tabs
  alert.tsx         Full-screen disaster warning
  onboarding.tsx    First launch: name, permissions, group
  settings.tsx      Settings (opens First aid, Offline Readiness)
src/
  state/AppContext.tsx   The single app store; the only place services are wired together
  services/              Firebase, location, routing, alerts, offline storage
  lib/                   Pure, tested logic (geo math, hazards, phone numbers, …)
  components/            Shared UI
docs/TEAM_PLAN.md   Who owns what, tasks and the demo script
```

---

## Contributing

This is a DubHacks 2026 project. Team members: start with **[docs/TEAM_PLAN.md](docs/TEAM_PLAN.md)** (owners, tasks, demo script) and **[CLAUDE.md](CLAUDE.md)** (commands, architecture, gotchas). Work on a branch, open a pull request, and ask before adding a dependency.

---

Built at DubHacks 2026.
