# Party Games Hub — Master Project Blueprint & Development Guide

> **IMPORTANT FOR FUTURE AGENTS / DEVELOPERS:**
> This document is the single source of truth for the **Party Games Hub** project. Read this file carefully before making any additions, refactoring code, or introducing new games/word packs.

---

## 1. Project Vision & Core Goal

The **Party Games Hub** is a lightweight, local-first web server application designed to host multiplayer party games over a local Wi-Fi / hotspot network or local host. 

### Primary Requirements
1. **Host Experience**:
   - Host runs the server on a Mac, Windows PC, Linux machine, or Android phone (via embedded background server / Termux / APK wrapper).
   - Server automatically detects local Wi-Fi IP address (e.g. `http://192.168.1.45:3000`), renders a QR code on the host screen, and provides a 1-tap **Web Share API** button (`navigator.share`) to send join links directly into WhatsApp, Telegram, iMessage, SMS, or copy to clipboard.
2. **Player Experience**:
   - Players join instantly on **ANY web browser** (iOS Safari, Android Chrome, Laptop Firefox/Chrome) by opening the shared URL or entering a 4-letter room code (e.g., `SPY1`, `CODE`).
   - No app installation required for joining players!
3. **Games Included Initially**:
   - **Codenames**: 5x5 card grid word-guessing game with Spymaster keycard matrix, Red vs Blue team scores, clues, assassin card, and 600+ curated double-meaning words.
   - **Spy (Spyfall)**: Secret role & location game where 1+ players are the "Spy" (who only see the category), while non-spies see the exact location and role. Includes timer, questioning helper, suspect voting, and spy guess modal with 35+ categories (450+ locations).
4. **Future-Proof Extensibility**:
   - Modular plugin structure (`/server/games/` and `/public/games/`).
   - Adding Game #3, #4, #5 (e.g. Trivia, Skribbl, Werewolf) should be plug-and-play.
   - Word packs stored in external JSON files (`words.json`, `categories.json`) for zero-code content updates.

---

## 2. System Architecture & Tech Stack

```
Games/
├── server/
│   ├── server.js                # Main Express HTTP & Socket.io server entrypoint
│   ├── core/
│   │   ├── NetworkDetector.js   # Scans network interfaces for local IP
│   │   ├── RoomManager.js       # Handles room creation, 4-letter codes, player sockets
│   │   └── GameRegistry.js      # Discovers and registers game modules dynamically
│   ├── games/                   # GAME PLUGINS DIRECTORY
│   │   ├── codenames/
│   │   │   ├── index.js         # Server-side logic for Codenames
│   │   │   └── data/words.json  # 600+ externalized words
│   │   └── spy/
│   │       ├── index.js         # Server-side logic for Spyfall
│   │       └── data/categories.json # 35+ categories & 450+ locations
├── public/
│   ├── index.html               # Main Hub Single Page Application shell
│   ├── css/
│   │   └── style.css            # Dark mode Glassmorphism design system
│   ├── js/
│   │   ├── hub.js               # Client Hub room management & Web Share/QR code logic
│   │   └── socket-client.js     # Socket.io connection helper
│   └── games/                   # CLIENT-SIDE GAME VIEWS
│       ├── codenames.js         # Codenames UI & interactive grid
│       └── spy.js               # Spy UI, peek card, voting modal & location grid
├── package.json                 # Dependencies (express, socket.io, qrcode)
└── PROJECT_BLUEPRINT.md         # This blueprint document
```

### Technology Selection Rationale
- **Backend**: Node.js + Express + Socket.io. Real-time bi-directional events for game turns, timer countdowns, card reveals, and vote updates.
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, and CSS Glassmorphism. No heavy framework (React/Vue/Angular) build step required — ensures instant local serving, tiny memory footprint, fast loading on low-end phone browsers, and zero bundler issues on mobile.
- **Networking**: `os.networkInterfaces()` auto-detects IPv4 LAN addresses.

---

## 3. Strict Rules & Anti-Patterns ("WHAT NOT TO DO")

To maintain project quality and prevent regressions, future agents and developers **MUST NOT**:

1. ❌ **DO NOT hardcode IP addresses or hostnames.**
   - *Why*: User Wi-Fi networks change dynamically (e.g. `192.168.1.15`, `10.0.0.4`, `172.20.10.2`). Always rely on `NetworkDetector.js` to discover the active LAN IP interface.

2. ❌ **DO NOT embed words or categories inside JS logic files.**
   - *Why*: All word lists and categories MUST live in `/server/games/[game-id]/data/*.json`. This allows the user or AI to add 500+ new words or 50 new categories simply by updating JSON files without touching code.

3. ❌ **DO NOT require player app installation or native plugins for browsers.**
   - *Why*: The core premise is that any friend can open Chrome/Safari on their phone and play instantly. Keep browser code 100% compliant with standard Web APIs (WebSockets, Web Share API, standard touch events).

4. ❌ **DO NOT break the modular Game Plugin Architecture.**
   - *Why*: Never put game-specific rules (like Codenames card flipping or Spy timer) inside `RoomManager.js` or `server.js`. Keep game logic strictly encapsulated inside `/server/games/[game-id]/index.js` and register it via `GameRegistry.js`.

5. ❌ **DO NOT use boring, generic, or truncated word lists.**
   - *Why*: Replayability depends on content richness. Codenames requires 600+ words across diverse domains (Classic, Pop Culture, Food, Nature, Science). Spy requires 35+ distinct categories with 10-15 locations each.

6. ❌ **DO NOT leak secret roles or keycards over public WebSockets.**
   - *Why*: In Codenames, field operatives must NOT receive the Keycard colors in socket broadcasts. Spymaster data is sent ONLY to sockets assigned to Spymaster roles. In Spy, non-spies get location details while the spy socket receives ONLY `"YOU ARE THE SPY"`.

7. ❌ **DO NOT use plain/boring default UI styles.**
   - *Why*: The design MUST feel modern and premium. Use curated HSL dark mode palettes, vibrant glowing accents, glassmorphism (`backdrop-filter: blur`), smooth 3D flip card animations, and mobile-friendly tap targets (minimum 44x44px).

---

## 4. Game Rules, Controversial House Rules & Settings

Both games include a dedicated **⚙️ House Rules & Settings** modal for the host to customize controversial game rules debated on online forums:

### Game 1: Codenames Configurable House Rules
- **Starting Team Advantage**:
  - *Random (9 vs 8 cards)*: Standard rules give starting team 9 cards.
  - *Equal Cards (8 vs 8 cards)*: Popular house rule for equal difficulty.
  - *Red / Blue Team Starts*: Host manual selection.
- **Guess Count Limit**:
  - *Clue + 1*: Standard catch-up rule (allows guessing 1 extra card from missed clues).
  - *Strict*: Exact clue count only.
  - *Unlimited*: Guess as long as operatives keep revealing correct cards.
- **Assassin Penalty**:
  - *Instant Loss*: Standard rule.
  - *Soft Assassin*: Ends turn and subtracts 1 point (prevents 1 accidental tap from ruining a 20-min match).
- **Turn Timer**: Optional 60s, 90s, 120s countdown per turn.
- **Spymaster Slot Lock**: Once a player claims a Spymaster slot, that position is locked for the match and cannot be stolen until game restart.
- **Game Restart & Lobby Permission**: Only the Host can restart an active game or return players to the lobby.

### Game 2: Spy (Spyfall) Configurable House Rules
- **Number of Spies**: 1 Spy (Standard), 2 Spies (Suggested for 8+ players), or 3 Spies (Suggested for 12+ players).
- **Spy Knowledge / Difficulty**:
  - *Standard Category Given*: Spy gets Category + "YOU ARE THE SPY".
  - *Hardcore Blind*: Spy receives NO category info (100% blind spy).
- **Imposter Guessing**: Typed text input with case-insensitive and whitespace-normalized matching.
- **Voting Elimination Role Reveal**: Masked during play (role is NOT revealed upon elimination unless the last imposter is ousted to win the match).
- **Round Duration**: 2 mins, 3 mins, 5 mins.

### Audio & Sound System (`SoundFX`)
- Web Audio API synthesizer for zero-dependency sound effects:
  - Card flip clicks, clue chimes, victory fanfare, and assassin explosions.
  - Short 1.5-second bell chime for discussion/voting timer expiry in Imposter game and turn timeout for active team in Codenames.
  - Color-specific audio feedback for operative card reveals (correct chime, wrong buzz, dark assassin boom).
- Includes mute/unmute toggle in header.

---

## 5. Host Execution & Android APK Setup

### Standard Host (Mac / Windows / Linux)
```bash
# 1. Install dependencies
npm install

# 2. Start the Game Hub Server
npm start

# Output will display:
# 🚀 Party Games Hub is running!
# 📱 Local Network URL: http://192.168.1.45:3000
# 💻 Localhost URL:     http://localhost:3000
```

### Android APK / Phone Host Setup
To run the server directly on an Android device to host games on the go:
1. **Termux Method**: Install Termux on Android, run `pkg install nodejs`, clone/copy workspace, and execute `node server/server.js`.
2. **Capacitor / Native Wrapper**: Package `server.js` with a local Node.js background service inside an Android APK.

---

## 6. Checklist for Adding New Games or Word Packs

### How to Add a New Game (#3, #4, etc.)
1. Create directory `/server/games/my-new-game/`.
2. Create `index.js` implementing standard methods: `init(room)`, `onAction(socket, action)`, `getState(role)`.
3. Create client view `/public/games/my-new-game.js`.
4. Register the game in `/server/games/registry.js` with `id`, `name`, `icon`, `minPlayers`, `maxPlayers`.

### How to Add More Words / Categories
1. **For Codenames**: Edit `/server/games/codenames/data/words.json` and append new strings to the array.
2. **For Spy**: Edit `/server/games/spy/data/categories.json` and add a new category object:
   ```json
   {
     "category": "Theme Park",
     "locations": [
       {"name": "Roller Coaster Queue", "roles": ["Thill Seeker", "Ride Operator", "Photo Agent"]},
       {"name": "Funnel Cake Stand", "roles": ["Chef", "Hungry Tourist", "Cashier"]}
     ]
   }
   ```

---

*This blueprint document is preserved in the repository root at `PROJECT_BLUEPRINT.md` for context persistence across sessions.*
