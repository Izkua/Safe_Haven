---
name: SafeHaven
description: Emergency guidance anyone can use. Calm grey or beige surfaces, real buttons, and color only when it means something.
colors:
  slate: "#1E2023"
  slate-raised: "#2D3035"
  mist: "#ECEDEE"
  mist-soft: "#A6ABB2"
  slate-rule: "#3A3E44"
  danger-text-dark: "#FF6B5E"
  safe-dark: "#5CC08B"
  sand: "#E8DFCF"
  sand-deep: "#DCCFB8"
  bark: "#2A2118"
  bark-soft: "#5E5141"
  sand-rule: "#CDBFA6"
  sand-ink: "#F4EEE3"
  danger-text-light: "#962A1B"
  safe-light: "#255E42"
  danger: "#B3261E"
  on-danger: "#FFF4EF"
  watch: "#E3A21A"
  safe-fill: "#2C6B4B"
typography:
  title:
    fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
  heading:
    fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "25px"
  body:
    fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "24px"
  button:
    fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  label:
    fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
  emergency:
    fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: "50px"
  fine:
    fontFamily: "-apple-system, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  control: "12px"
  segment: "8px"
  sheet: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "16px"
  gutter: "20px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.slate}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "56px"
  button-primary-light:
    backgroundColor: "{colors.bark}"
    textColor: "{colors.sand-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.slate-raised}"
    textColor: "{colors.mist}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "56px"
  button-secondary-light:
    backgroundColor: "{colors.sand-deep}"
    textColor: "{colors.bark}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "56px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-danger}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "56px"
  button-plain-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger-text-dark}"
    typography: "{typography.button}"
    height: "48px"
  status-safe-active:
    backgroundColor: "{colors.safe-fill}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.control}"
    height: "88px"
  status-help-active:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-danger}"
    rounded: "{rounded.control}"
    height: "88px"
  input:
    backgroundColor: "{colors.slate-raised}"
    textColor: "{colors.mist}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "56px"
  map-sheet:
    backgroundColor: "{colors.slate}"
    rounded: "{rounded.sheet}"
    padding: "18px 16px 12px"
---

# Design System: SafeHaven

## Overview

**Creative North Star: "The Field Card"**

SafeHaven should feel like the calm instruction card in a go-bag: plain words, big readable buttons, and nothing to decode. Anyone (a child, a grandparent, someone shaking and in the dark) should be able to read the screen and tap the right thing on the first try. The interface is quiet on purpose, so that when something does turn red it is unmistakable.

**Dark is the default.** Surfaces are a soft neutral grey with near-white text. Light mode, chosen in First aid › Appearance or by "Match phone", is a warm beige with dark-brown text. Pure white is not used anywhere. Every action is a real button: a rounded 56pt shape with an icon and a short verb label. The interface uses no boxed "cards", no dashboard metrics and no decorative rules. Grouping comes from spacing and simple section headings.

Urgency still escalates in visible steps (the **urgency ladder**): Watch is an amber header, Warning a red header, and Emergency the whole screen in red. Haptics follow the level: one light tap, then two heavy pulses, then repeating pulses until the user acts.

**Key Characteristics:**
- Dark grey by default, warm beige in light mode, never pure white.
- Real buttons: rounded (12px), at least 56pt tall, icon plus a verb label, centered.
- Three button kinds: filled (one main action), tonal (everything else), plain text (cancel and leave).
- Color is earned: red for danger, amber for watch, green for safe. Everything else is neutral.
- iPhone-standard type in two weights; nothing oversized except the emergency headline.
- Secondary tasks (forms, editing) stay hidden until the user asks for them.

## Colors

Two calm neutral worlds and three signal colors that each mean exactly one thing. Every semantic token in `src/theme.ts` has a light and a dark value. On iOS they swap live (`DynamicColorIOS`); Android resolves them at launch.

### Primary
- **Mist** (#ECEDEE): text, and the **filled main button** in dark mode (with Slate text).
- **Bark** (#2A2118): text, and the filled main button in light mode (with Sand Ink text).

### Secondary
- **Danger Red** (#B3261E): a **fill** only, for alert headers, the emergency screen, the active "I need help" button and pin badges, with On Danger (#FFF4EF) text (6.1:1).
- **Danger Text** (dark #FF6B5E, light #962A1B): red **text and icons** on the page or on a tonal button ("Needs help", "Leave group", "Practice a disaster", affected-area lines).

### Tertiary
- **Watch Amber** (#E3A21A): the advisory header fill only, always with Bark text (7.1:1).
- **Safe Green** (dark #5CC08B, light #255E42): safe icons, text and shelter markers. **Safe Fill** (#2C6B4B) is the active "I'm safe" button, with Sand Ink text (5.5:1).

### Neutral
- **Slate** (#1E2023) / **Sand** (#E8DFCF): the page and the map sheet.
- **Slate Raised** (#2D3035) / **Sand Deep** (#DCCFB8): tonal buttons, inputs, banners and segmented controls.
- **Mist Soft** (#A6ABB2) / **Bark Soft** (#5E5141): secondary text. It's at least 5:1 on both surfaces.
- **Slate Rule** (#3A3E44) / **Sand Rule** (#CDBFA6): hairline dividers between list rows only.

### Named Rules
**The Earned Color Rule.** Red means danger, amber means watch, green means safe, and nothing else gets a color. If a screen shows red and nothing is dangerous, it's wrong. Drills are practice, not danger: they're always neutral.

**The Danger Follows You Rule.** Live danger (an active alert, or a member asking for help) stays visible after the alert screen closes: a red Danger Banner at the top of the Map, and a red "!" badge on the Group tab.

**The No White Rule.** No surface or text uses pure #FFFFFF. The brightest values are Mist (#ECEDEE), Sand Ink (#F4EEE3) and On Danger (#FFF4EF).

**The Fill-or-Text Rule.** Red and green each come in two tokens. Use `colors.danger` / `colors.safeFill` for fills and `colors.dangerText` / `colors.safe` for text and icons. Never mix them.

**The Identity Exception.** Group members each get a distinct identity color on the map (`memberPalette`), because people must be told apart at a glance. It's the only non-signal color.

## Typography

**Font:** the system font (SF Pro on iOS, Roboto on Android), loaded from nothing.

**Character:** plain and familiar, in two weights: 400 for reading and 600 for anything you act on or scan for. Titles are 700.

### Hierarchy
- **Title** (700, 28/34): one per screen ("First aid", the group name, the alert headline at Warning and Watch).
- **Emergency** (700, 44/50): only the full-red emergency headline ("Drop. Cover. Hold on.").
- **Heading** (600, 20/25): section headings ("How are you?", "People", "What to do now") and the map sheet's destination.
- **Body** (400, 17/24): instructions and descriptions. 17 is the floor for anything someone must read to stay safe.
- **Button** (600, 17): every button label.
- **Label** (400, 15/20, secondary color): supporting lines ("Meeting point · 340 m · 5 min walk", member status).
- **Fine** (400, 12/16): attribution and routing disclaimers only.

### Named Rules
**The Plain Words Rule.** Labels are verbs or short phrases a child could read aloud: "Go to meeting point", "I need help", "Invite people". No jargon and no labels above headings. Write sentences, not `·`-separated fragments: "340 m away (about 5 min walk)", "Safe, 3 min ago". The `·` is only for attribution credits.

## Layout

A single column with a 20px gutter. Sections are separated by 28px of space and a 20px heading. There are no boxes, borders or rules between sections. Lists use hairline dividers between rows only.

The map is full-bleed under a **rounded bottom sheet** (20px top corners). The sheet holds:
- the destination name and a one-line summary;
- one filled main button;
- a row of two tonal buttons (Compass, Save map);
- a plain, neutral "Practice a drill" link.

Red Danger Banners stack above everything at the top when an alert is active or someone needs help.

**Select, then confirm.** Long-pressing the map or tapping a safe area only *selects* it (a dashed pending marker). The sheet switches to that place with **Set as meeting point** (or **Go to [place]**) and **Cancel**, hiding the other buttons. Nothing changes until the user confirms. Without a selection, the main button is greyed out as "Route shown" while the current route is on screen. It re-enables to retry a straight-line route, or when someone else moves the meeting point.

Status notices (no signal, saved map, routing) stack as rounded tonal banners under the top safe area.

Forms appear inline only after their button is tapped (Join with a code, Start a new group, Change meeting point), and each has its own Cancel.

### Named Rules
**The One Filled Button Rule.** Each screen has one filled button, the main action. Everything else is tonal or plain.

**The Ask-First Rule.** Forms and editing controls stay hidden until the user taps the button that needs them.

## Elevation & Depth

None. There are no shadows, blur or gradients. Depth comes from the two-tone surfaces (page vs. tonal button), the rounded map sheet sitting on the map, and full-color takeovers (the red emergency screen).

### Named Rules
**The No-Shadow Rule.** Separate things with surface tone or space, never a shadow.

## Shapes

Soft, friendly and consistent:
- Buttons, inputs, banners and the segmented control use 12px corners.
- The map sheet uses 20px top corners.
- Status markers are icons, not shapes: a filled check for safe, an alert for needs help, an empty circle for no check-in.
- On the map, the meeting point is a rounded diamond outlined in the text color, safe areas are green dots, and members are 40px circles with their initial, ringed in the page color.

## Components

### Buttons (`BigButton`)
- **Shape:** 12px corners, at least 56pt tall, a 22pt icon plus a 17/600 label, centered.
- **Primary:** filled with the text color (Mist in dark, Bark in light), with page-color text. One per screen.
- **Secondary:** a tonal fill (Slate Raised or Sand Deep) with text-color label and icon.
- **Danger:** a Danger Red fill with On Danger text. Reserved for danger.
- **Plain:** text only, 48pt tall. Used for Cancel, Leave group and Practice a disaster, with `tone="danger"` for red.
- **States:** pressed is 70% opacity; disabled is 45%; loading shows a spinner in the label color.

### Status pair (I'm safe / I need help)
Two 88pt tonal buttons with a 28pt icon above the label. "I'm safe" uses a green icon and label. "I need help" is the alarm: red icon and label **plus a 2px red outline even at rest**, so it outranks the reassurance. When active they fill: Safe Fill or Danger Red, with light text. Tapping one plays a selection haptic.

### Danger Banner
A full-width Danger Red banner (12px corners, at least 64pt tall) with a white-ish icon, a bold title and a one-line action: "Earthquake warning / Tap to see what to do", "Sis needs help / Tap to see where". Drills are titled "Drill: …". It is announced to screen readers and is the only red banner in the app.

### Onboarding
Each step centers the icon (64pt, text color), title (28/700) and body (17, max ~340pt wide) as one block, with the buttons below.

### Member rows
A 26pt status icon, the name (17/600), a status line (15; red and 600 for "Needs help"), and the distance (17/600) on the right. Hairline dividers between rows; "Needs help" sorts first.

### Inputs
A tonal fill with no border, 12px corners, 56pt tall, 17pt text, and a 15pt label above. Invite-code inputs are 24/600, centered, with 6px letter spacing.

### Segmented control (Appearance)
A tonal track with 4px padding and three 48pt segments (Dark, Light, Match phone). The selected segment is filled with the primary color.

### Navigation
Standard iOS tabs with an icon and a 12/600 label (Map, Group, First aid). The active tab uses the text color and a filled icon; inactive tabs use the secondary color and an outline icon. A hairline top divider. The Group tab shows a red "!" badge while anyone needs help. Stack headers match the page, with no shadow.

### Offline banner
A rounded tonal banner with a cloud-offline icon: "No signal · last updated 14 min ago". Being offline isn't danger, so it's never red or amber.

### Alert screen (signature component)
- **Header:** the headline comes first (28pt, or 44pt in an emergency), then a meta line with the hazard icon ("Earthquake · Emergency · just now").
  - **Watch:** an amber header with Bark text.
  - **Warning:** a red header with light text.
  - **Emergency:** the full screen is Danger Red.
- **Body:** the description, then an affected-area line with an icon, then numbered "What to do now" steps and the official note.
- **Actions,** pinned at the bottom:
  - "Go to [safest place]" is filled: a light fill with red text on the emergency screen, the primary color elsewhere.
  - "Go to meeting point" and "I'm safe" are tonal. On red they're a translucent light tint.
- **Dismissing:** an emergency dismisses only with press-and-hold (800ms); other levels show a plain Dismiss link. The screen can't be swiped away.

## Do's and Don'ts

### Do:
- **Do** use `BigButton` for every action, with an icon and a verb label, at least 56pt tall.
- **Do** keep exactly one filled button per screen; use tonal for the rest and plain for Cancel or Leave.
- **Do** use `colors.*` tokens so screens adapt to dark (default) and light.
- **Do** separate sections with space and a 20pt heading, not boxes or rules.
- **Do** hide forms and editing until the user taps the button that needs them.
- **Do** pair every status color with an icon and a word ("Needs help", "Safe").
- **Do** escalate along the urgency ladder (watch → warning → emergency) based on real severity.

### Don't:
- **Don't** use pure white (#FFFFFF), shadows, gradients or blur.
- **Don't** wrap content in bordered cards or build dashboard-style metric tiles (big number plus small label).
- **Don't** use red, amber or green for anything that isn't danger, watch or safe, including drills and practice.
- **Don't** change the meeting point or the route on a map tap or long-press alone; always select, then confirm.
- **Don't** chain fragments with `·` in UI copy.
- **Don't** put a label above a heading, or use type larger than 28pt outside the emergency headline.
- **Don't** set instructions below 17pt.
- **Don't** make an emergency alert dismissible with a single tap or a swipe.
- **Don't** add icon sets beyond Ionicons, imported from `@expo/vector-icons/Ionicons` only.
