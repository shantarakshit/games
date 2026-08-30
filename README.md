# Party Games Hub 🎮

A real-time, local-first, multi-device web application for playing popular party games (**Mafia**, **Codenames**, and **The Imposter Game / Spyfall**) with friends over Wi-Fi, LAN, or cloud hosting (e.g., Render) — zero app store downloads or registrations required!

---

## 🎲 Included Games

### 1. 🔪 **Mafia** (6–18 Players)
The classic social deduction game of deception, investigation, protection, and survival.

- **Roles & Concurrent Night Actions**:
  - **👑 Host / Narrator**: Controls game flow and narration pacing, views all secret player roles in real-time God-mode, monitors live submission progress across all roles, and accesses the round-by-round Secret Action Ledger.
  - **🔪 Murderers (1–3 players)**: Coordinate simultaneously during the unified night phase. View teammates' live targets and consensus status in real-time. If consensus isn't reached before phase end, a target is chosen randomly from among the split votes, with secret notifications delivered to the murderers and host. *Restrictions: Cannot target the Host, dead players, or fellow Murderers.*
  - **💉 Doctor (1 player)**: Simultaneously chooses 1 living player to protect each night (can protect themselves, but cannot protect the Host or dead players). *Rule: Cannot protect the same player two rounds in a row.*
  - **🔍 Detective (1 player)**: Simultaneously investigates 1 living suspect each night to discover if they are a Murderer. Maintains a personal in-game Detective Investigation Ledger. *Restrictions: Cannot investigate the Host, dead players, themselves, or previously investigated suspects.*
  - **😇 Civilians (Townspeople)**: Stay actively engaged during the night by picking their favorite living townsperson (non-self, non-host, non-dead). Sleep at night, debate during daytime, and vote to eliminate suspected murderers.
- **8-Phase Narration & Day/Night Pipeline**:
  1. `role_reveal`: Players secretly peek at their assigned role on mobile using pointer-captured card flips.
  2. `night`: Simultaneous night actions for Murderers, Doctor, Detective, and Civilians.
  3. `morning_narration`: Host receives the secret night resolution and narrates sunrise to the room while player devices display a suspenseful waiting buffer.
  4. `day_morning`: Morning Announcement Banner reveals the sunrise outcome (Doctor miracle save or murdered victim) on all phones.
  5. `day_discussion`: Town discussion and debate with real-time countdown (or untimed host pacing).
  6. `day_voting`: Secret elimination voting with live anonymous candidate vote totals and abstain option.
  7. `vote_narration`: Dusk suspense buffer where Host narrates the town vote results aloud before showing results.
  8. `day_tally`: Results Tally screen displays vote counts, elimination stamps, and gavel sound effects across all player devices before advancing to the next Night round or concluding the game.
- **Daytime Voting & Elimination**:
  - **Elimination Mode Setting**: Host can configure **Plurality** (highest votes eliminated; ties cancel) vs **Strict Majority** (>50% of living voters required).
  - **Timer Synchronization**: Selecting Infinite / Untimed Discussion (`0s`) in Settings automatically synchronizes the voting timer to Untimed (`0s`), while still allowing the Host to independently specify a finite voting countdown if desired.
  - **Live Anonymous Vote Counters**: During daytime voting, candidate cards display live vote counts (`🗳️ X votes`) updating in real-time while keeping voter identities strictly secret.
  - **Dynamic Vote Swapping**: Active voters can tap another suspect at any time during voting to instantly swap their ballot.
  - **Self-Vote Prevention & Abstain Ballot**: Players cannot vote for themselves, and active voters can choose to Abstain/Skip.
  - **Tie Vote Protection**: If two or more suspects tie for the highest vote count, it is resolved as a tie and **no one is eliminated** for that round.
  - **Spectator Experience**: Eliminated players remain in the room as Spectators, watching live voting tallies, morning announcements, and end-game statistics.
- **Win Conditions**:
  - **🏆 Civilians Win**: When all Murderers are successfully eliminated.
  - **🏆 Mafia Wins**: When living Murderers equal or outnumber living Civilians (50% or more of the town).
- **Dedicated Match Timeline Ledger**: Complete match history detailing night targets, saves, investigations, split vote resolutions, and daytime elimination votes displayed in a dedicated, scrollable box exclusively to the 👑 Host.

---

### 2. 🕵️‍♂️ **Codenames** (4–16 Players)
Team-based word association and deduction (Red Team vs. Blue Team).

- **Role Setup**: Red Spymaster, Blue Spymaster, and multiple Field Operatives per team with pre-game role claiming locks.
- **Gameplay**: Spymasters provide 1-word clues with a target number. Field Operatives discuss and tap word cards on their turn.
- **Strict Role Separation**: Spymasters cannot tap cards on behalf of players; Operatives cannot submit clues; inactive teams cannot act out of turn.
- **Card Types**: Team Agents (Red/Blue), Innocent Bystanders (Neutral), and the sudden-death Assassin card.
- **Controversial Rule Settings**:
  - **Starting Advantage**: Random (9 vs 8 cards), Equal (8 vs 8 cards), or Team-specific start.
  - **Guess Limit**: Clue + 1 (Standard catch-up rule), Strict (Clue number only), or Unlimited.
  - **Assassin Mode**: Instant Loss (Standard tournament rule) or Soft (Lose point, +1 card penalty to team, and pass turn).
  - **Turn Timers**: Configurable timer per turn with audio warnings.
- **Scrollable Log**: Real-time turn action and clue log with auto-scrolling that never pushes the 25-card grid out of view.

---

### 3. 🕵️ **The Imposter Game (Spyfall Variant)** (3–16 Players)
A high-stakes bluffing game where everyone knows the secret category and location except the Imposter(s).

- **Randomized Discussion Starter**: Before the discussion phase begins, a living player (spy or non-spy) is randomly chosen to start the discussion. A prominent visual banner is broadcast to all players and the speaker is tagged in the player roster.
- **Unified Unlimited Discussion & Voting**: If discussion is set to Untimed (`0s`), the voting phase is automatically untimed too, giving the Host clean controls (`📊 End Vote & Tally ➔`) to advance when discussion ends.
- **Deliberate Voting Phase**: Voting does not auto-advance when all votes are in; players can change/swap votes until the timer runs down or the Host ends the vote.
- **Privacy First (Pointer Capture Peek)**: Hold to peek at your secret location and role with pointer capture, preventing accidental leaks on iOS Safari and Android.
- **Cover-Typing Phase (Optional)**: 20-second disguised typing phase where innocents type assigned words and impostors type `PASS` (or submit a location guess) to avoid device physical cues.
- **Elimination Mode Setting**: Host can configure **Plurality** (highest votes eliminated; ties cancel) vs **Strict Majority** (>50% of living voters required).
- **Unanimous "No Imposters Left" Vote**: Option unlocked dynamically once enough players have been eliminated to make 0 impostors mathematically possible. **Always requires a 100% unanimous vote from all living players.**
- **Host Pacing Controls**: Host can add `+30s` or advance/skip timers anytime during discussion, cover-typing, and voting (`⏭ Skip Timer` to run down to 0).
- **Spy Knowledge Difficulty**: Category given (Standard) or Hardcore Blind (No category given to Imposters).
- **Spectator Mode**: Deceased players spectate remaining rounds with real-time voting progress.

---

## 🔒 Session Resilience, Mobile Support & Auto-Reconnection

- **⚡ Silent Auto-Reconnection**: The client automatically caches active session credentials (`party_active_room_code`, `party_last_name`, `party_last_pin`) in `localStorage`. If a player's phone sleeps, locks, or changes networks, waking the phone or switching tabs triggers an instantaneous background re-authentication that restores their exact game view and role without page reloads.
- **🔄 Socket Target Migration**: If a player disconnects and reconnects mid-game with a new socket ID, all active vote targets, doctor saves, detective investigation records, confirmed victim pointers, and tally results seamlessly migrate to their new connection.
- **📱 Screen Wake Lock API**: Automatically activates `navigator.wakeLock` during active gameplay (Mafia, Spy, and Codenames), keeping phone screens awake and preventing sleep/dimming during story narration and debate.
- **⏱️ 15-Minute Mid-Game Disconnect Tolerance**: Mid-game player slots and roles are retained for 15 minutes upon disconnect, ensuring no player is kicked out during long physical room discussions.
- **💓 Tuned Socket Heartbeats**: Configured with 1-minute `pingTimeout` (`60000ms`) and 10-second `pingInterval` to prevent accidental drops from mobile background throttling.
- **🍎 Mobile Safari / iOS Compatibility**: Fixed WebKit `:active` role peek requirements, removed 300ms touch delays via `touch-action: manipulation`, and suppressed iOS long-press text magnifiers (`-webkit-touch-callout: none`).
- **4-Digit PIN Nickname Protection**: Players set a 4-digit PIN upon joining. If a player switches devices or returns later, re-entering their PIN instantly reconnects them to their reserved spot.
- **Smart Away Badges**: When a player drops connection in the lobby, they are flagged as `😴 Away`. If they leave explicitly (`Leave Room` or `Logout`), they are removed immediately.
- **Host Controls**: Host can transfer host privileges (`👑 Make Host`), remove players (`❌ Remove`), adjust timers, or advance phases.

---

## 🏗️ Modular Architecture Overview

```
├── server/
│   ├── config.js               # Global server constants and timings
│   ├── server.js               # Express & Socket.io entry point
│   ├── routes/
│   │   └── api.js              # Network detection, QR generation & /api/reset
│   ├── sockets/
│   │   └── socketHandler.js    # Socket.io connection & room event routing
│   ├── core/
│   │   ├── RoomManager.js      # Room lifecycle & game dispatch
│   │   ├── PlayerManager.js    # Player sessions, PIN auth & away timers
│   │   ├── RoomBroadcaster.js  # Client DTO serialization & socket emits
│   │   ├── GameRegistry.js     # Dynamic game plugin loader
│   │   └── NetworkDetector.js  # Local Wi-Fi IPv4 auto-detection
│   └── games/
│       ├── codenames/          # Codenames plugin & instance
│       ├── spy/                # Imposter game plugin & instance
│       └── mafia/              # Mafia plugin, RoleManager, Handlers & Ledger
├── tests/
│   └── regression-suite.js     # Automated live regression test suite
└── public/
    ├── index.html              # Single Page Application layout
    ├── css/                    # Modular Glassmorphism design system
    │   ├── style.css           # Master stylesheet
    │   └── modules/            # Component styles (base, header, lobby, modals, games)
    └── js/
        ├── sound-fx.js         # Web Audio API synthesized sound effects
        ├── socket-client.js    # Socket.io client wrapper
        ├── hub.js              # Main application orchestrator
        ├── core/
        │   ├── state.js        # Reactive client state store
        │   ├── router.js       # View switcher & navigation router
        │   ├── session.js      # Session persistence & silent auto-reconnect
        │   └── wakeLock.js     # Screen Wake Lock API manager
        ├── lobby/              # Lobby UI component
        ├── modals/             # PIN auth, settings, rules, share & confirm dialogs
        └── games/              # Codenames, Spy, and Mafia modular controllers
```

---

## 🧪 Automated Testing & Regression

The repository includes a comprehensive, automated regression suite covering all games, rules, role restrictions, edge cases, and socket events.

```bash
# Run the complete automated regression test suite
npm test
```

### What `npm test` Validates:
1. **Lobby & Security**: Room creation with 4-digit PINs, nickname collision blocks, invalid PIN rejections, host privileges enforcement, and kicking players.
2. **Mafia Full Match**: Auto role distribution (Murderers, Doctor, Detective, Civilians), Doctor miracle saves, Detective inquiries & notebook history, voting plurality/majority, dusk narration, day tally screen, and Civilian victory.
3. **Mafia Edge Cases**: Doctor consecutive save restriction, Detective single-inquiry & re-investigation blocks, and strict majority threshold failure (0 eliminations on tie/under-threshold).
4. **Spy (Impostor)**: Standard vs. Hardcore Blind modes, cover-typing camouflage, and single location guess limits.
5. **Codenames**: Team selection, Spymaster claim locks, strict role separation (Operatives cannot give clues, Spymasters cannot tap cards), and Instant Loss vs. Soft Assassin penalty modes.
6. **Smart Server Lifecycle**: Automatically connects to the active server on `http://127.0.0.1:3000` or spawns a transient test server in-memory, ensuring seamless execution in both local development and CI/CD pipelines.

---

## ⚙️ Server Reset Endpoint

To instantly restart server state, clear rooms, disconnect lingering clients, and assign Host privileges to the next connecting player:

- **Endpoint**: `http://<server-ip>:3000/api/reset` (supports `GET` or `POST`)

```bash
# Example reset command via cURL
curl -X POST http://localhost:3000/api/reset
```

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# Or run with live file watching for development
npm run dev
```

Open `http://localhost:3000` in your browser, or connect mobile devices on the same Wi-Fi network using the local network URL displayed in the server terminal and header.

---

## 📦 Production Deployment

Built with pure Vanilla HTML5, CSS3, and Node.js / Express / Socket.io with zero build steps or bundlers.

```bash
# Set environment variables (optional)
PORT=3000
PUBLIC_URL=https://your-domain.com

# Start the server
npm start
```
