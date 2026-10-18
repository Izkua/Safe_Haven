# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Every member of a group equally: families, roommates and friend groups, including teens and older relatives. Design for the least tech-comfortable member, in a panic.

The moments they open SafeHaven:
- **Before a disaster (calm):** someone creates or joins a group with a 6-character invite code, sets a meeting place, and optionally saves an offline map.
- **During or right after a disaster (stressed):** they're told what to do now, told whether they're in the affected area, routed to the meeting place or the safest nearby place, can mark "I'm safe" or "Need help", and see where everyone else is. They may have no signal, may be using one hand, and may be moving.

## Product Purpose

SafeHaven warns people about nearby natural disasters, tells them what to do right now, and guides them to a safe place or their group's meeting place. It keeps a group aware of each other's location and status. Success means everyone in the group reaches safety and knows the others are safe, even when the cell network is down.

## Positioning

Two claims together, equally weighted. Heavy family-tracking apps such as Life360 can't truthfully make either one:

1. **Works with no signal.** Before a disaster the app saves the group, meeting place, walking route and map tiles. With zero network it still shows the saved map, your GPS position, the meeting place, safe areas, last-known member locations (with how old they are), and a compass arrow with the distance. GPS works without cell service.
2. **Lightweight by design.** A small install, GPS only while the app is open (background tracking only in an opt-in emergency mode), throttled location writes, no analytics, and no UI kits.

## Operating Context

- Built at DubHacks 2026 by a 4-person team. Roles are MAP, SYNC, ALERTS and UI; ownership and checkpoints are in `docs/TEAM_PLAN.md`.
- The demo runs on iPhones in Expo Go around UW Seattle: create a group → set the meeting place → simulate a disaster → route to safety → airplane mode → the app still guides the user.
- Live data: National Weather Service active alerts (US only) and USGS earthquake feeds. Walking routes come from FOSSGIS/OSRM over OpenStreetMap. Offline tiles come from a configured raster provider (MapTiler) that requires attribution.
- Without a Firebase config, DEMO MODE runs on a mock group around UW (`src/mocks/demo.ts`).

## Capabilities and Constraints

- **Capabilities:** anonymous sign-in. Groups that you create or join with an invite code. A group meeting place, or a personal one when you're not in a group. Live member locations and safe / need-help status. Disaster alerts (NWS and USGS) with hazard-specific "what to do now" steps for earthquake, tsunami, flood, wildfire, hurricane and tornado. An affected-area check. A safest-nearby-place pick for each hazard. A disaster simulator for drills and the demo. Walking routes with a straight-line fallback. A saved offline map. An offline compass. Bundled first-aid cards.
- **Rules:** meeting-place changes are locked while offline. Routes don't account for hazards, and the app says so. Official instructions always come first ("call 911").
- **Stack:** Expo SDK 57 (not 58), React Native and TypeScript, Expo Router, the Firebase JS SDK, react-native-maps. New dependencies need team approval and must be Expo modules.
- **Expo Go limits:** background location and remote push need an EAS dev build. Android Expo Go lacks system notifications and often renders a blank Google base map. Android is a team test device only.
- **Undecided:** whether an EAS dev build (and an Apple Developer account) will exist for the demo. Real shelter data beyond the hand-seeded UW safe areas. An alert sound.

## Brand Commitments

- **Name:** SafeHaven.
- **Voice:** plain, calm and imperative. Sentence case. Tell people the one thing to do now ("Drop. Cover. Hold on.", "Go to meeting place"). Never alarmist unless the danger is real.
- **Visual reference:** the team's binding visual reference is the "SafeHaven Design Direction" canvas (claude.ai artifact). Visual decisions live there and in a future DESIGN.md, not here.

## Evidence on Hand

- Live public feeds (NWS, USGS) and the hazard guidance text in `src/lib/hazards.ts`.
- Mock demo data around UW in `src/mocks/demo.ts`.
- **Absent:** real users, testimonials, usage numbers, measured battery or size benchmarks, and partnerships. Don't fabricate any of these; measure install size and battery before citing them.

## Product Principles

1. **Guidance must survive a dead network.** Every core flow (map, meeting place, route, compass, status) degrades gracefully offline and shows how old its data is.
2. **One clear action at a time.** In an emergency, show what to do now and the single best next step before anything else.
3. **Usable by the least capable member, under stress.** Large targets, plain words, no hidden gestures for critical actions, and nothing that requires reading fine print.
4. **Calm until danger is real.** Urgency escalates only with real severity, so warnings keep their meaning.
5. **Light on the phone.** Every feature justifies its battery, data and install-size cost.

## Accessibility & Inclusion

Users may be panicked, injured, outdoors in bright sun, moving, using one hand, or older and less tech-comfortable. Critical actions must have large touch targets, high contrast, screen-reader labels, and confirmation for destructive or dismissive actions in emergencies. Safety meaning must never depend on color alone.
