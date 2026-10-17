# SafeHaven

**A lightweight iOS emergency safety app, built for DubHacks 2026.**

SafeHaven warns you about nearby natural disasters, points you to a safe area, and keeps your family or friends connected, including when the cell network is down.

---

## Why SafeHaven?

Apps like Life360 are heavy. They have large binaries, track GPS constantly, and drain the battery. In a disaster they often stop being useful once cell service goes down, which is when you need them most.

SafeHaven puts function first:

- **Light:** a small install that is gentle on the battery.
- **Focused:** only the features that matter in an emergency.
- **Offline-capable:** GPS works without cell service, so SafeHaven keeps working without a signal too.

---

## Core Features

### 1. Disaster Alerts and Safe Areas
Get alerts about natural disasters near you, with directions to the nearest safe area.

### 2. Live Location Sharing
Share your live location with family and friends so everyone knows where everyone is.

### 3. Group Meeting Place
Agree on a meeting place ahead of time so the group knows where to regroup when plans fall apart.

### 4. No-Signal Mode
With no cell service, SafeHaven still shows:
- A **cached map** of your area
- Your **current GPS position**
- Your group's **meeting place**
- Nearby **safe areas**
- A **route or compass** that points you to them

---

## Stretch Goals

These come after the core features work:

- [ ] **Groups:** create and manage multiple groups
- [ ] **UI polish**
- [ ] **Offline first-aid guides:** CPR, the Heimlich maneuver, and more, available without a connection
- [ ] **AI photo hazard analysis:** take a photo of your surroundings and get a hazard assessment

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Expo](https://expo.dev/) (React Native) |
| Language | TypeScript |
| Backend / realtime | Firebase (JS SDK) |
| Target platform | iOS |

### Why Expo?

The team develops on **Windows** and tests on **iPhones**. Expo lets us build and test iOS apps without a Mac.

**The tradeoff:** an Expo app has a larger binary than a fully native app, around **30–40 MB**. We accept that, and keep the app as small as we can with these rules:

- Use **Expo modules only** for native functionality.
- Use the **Firebase JS SDK** rather than native Firebase SDKs.
- **No UI kits or heavy third-party libraries.**

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS)
- An iPhone with the [Expo Go](https://expo.dev/go) app installed, or a development build (see the note below)
- A Firebase project

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd safehaven

# Install dependencies
npm install

# Start the dev server
npx expo start
```

Scan the QR code with your iPhone's camera to open the app.

> **Note:** Some features, such as background location, may need a [development build](https://docs.expo.dev/develop/development-builds/introduction/) instead of Expo Go. You can create iOS builds from Windows with [EAS Build](https://docs.expo.dev/build/introduction/).

### Firebase Configuration
Add your Firebase project's config to the app's environment (for example, a `.env` file). Don't commit keys to the repo.

---

## Contributing

This is a DubHacks 2026 project. Open an issue or pull request, and before adding a dependency, ask whether it's worth the extra size.

📋 **Team members: start with [docs/TEAM_PLAN.md][def].** It has each person's tasks, the checkpoints, a code map and the demo script.

---

## Team

Built at DubHacks 2026.


[def]: docs/TEAM_PLAN.md