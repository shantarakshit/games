# Party Games Hub 🎮

A real-time, local-first, multi-device web application for playing popular party games (**Mafia**, **Codenames**, and **The Imposter Game / Spyfall**) with friends over Wi-Fi, LAN, or cloud hosting (e.g., Render) — zero app store downloads or registrations required!

---

## 🎲 Included Games

### 1. 🔪 **Mafia** (6–18 Players)
The classic social deduction game of deception, investigation, protection, and survival.

- **Roles & Distribution**:
  - **👑 Host / Narrator**: Controls game pacing, reads narration prompts, views all secret player roles in real-time God-mode, and accesses the round-by-round Secret Action Ledger.
  - **🔪 Murderers (1–3 players)**: Secretly coordinate during the night, vote and swap targets in real-time with visual consensus confirmation. *Restrictions: Cannot target the Host, dead players, themselves, or fellow Murderers.*
  - **💉 Doctor (1 player)**: Protects 1 living player each night (can protect themselves, but cannot protect the Host or dead players). *Rule: Cannot protect the same player two rounds in a row.*
  - **🔍 Detective (1 player)**: Investigates 1 living suspect each night to discover if they are a Murderer. Maintains a personal in-game Detective Investigation Ledger. *Restrictions: Cannot investigate the Host, dead players, themselves, or previously investigated suspects.*
  - **😇 Civilians (Townspeople)**: Sleep at night, debate during daytime, and vote to eliminate suspected murderers.
- **Night Sequence & Privacy**:
  - **Silent Player Actions**: All audio cues and click sounds during night phases are suppressed on player devices to prevent physical giveaways in the room.
  - **Deceased Role Narration**: If the Doctor or Detective are eliminated, their night phase is not automatically skipped. The Host still receives a prompt to narrate the story aloud (maintaining a natural pause) so other players in the room cannot deduce who has been eliminated. Deceased players see a spectator screen and cannot perform actions.
- **Daytime Voting & Elimination**:
  - **Elimination Mode Setting**: Host can configure **Plurality** (highest votes eliminated; ties cancel) vs **Strict Majority** (>50% of living voters required).
  - **Unified Untimed Pacing**: When daytime discussion is configured with No Timer (Untimed), the daytime voting ballot automatically runs untimed as well, guided by the Narrator/Host.
  - **Deliberate Voting Progression**: The voting phase does not auto-advance merely because all living players have voted; it stays open so players can debate and swap votes until time runs out or the Host advances.
  - **Live Anonymous Vote Counters**: During daytime voting, each suspect's card displays a live counter badge (`🗳️ X votes`) updating in real-time as votes are cast.
  - **Dynamic Vote Swapping**: Active voters can tap another suspect at any time during the voting phase to instantly swap their ballot.
  - **Self-Vote Prevention & Abstain Ballot**: Players cannot vote for themselves, and active voters can choose to Abstain/Skip.
  - **Plurality / Majority Elimination**: In plurality mode, the single highest vote receiver is eliminated. In majority mode, a candidate must receive >50% of living player votes.
  - **Tie Vote Protection**: If two or more suspects tie for the highest vote count, it is resolved as a tie and **no one is eliminated** for that round.
  - **Spectator Experience**: Eliminated players remain in the room as Spectators, watching live voting tallies, morning announcements, and end-game statistics.
- **Win Conditions**:
  - **🏆 Civilians Win**: When all Murderers are successfully eliminated.
  - **🏆 Mafia Wins**: When living Murderers equal or outnumber living Civilians ($\ge$).
- **Dedicated Match Timeline Ledger**: Complete match history detailing night targets, saves, investigations, and daytime elimination votes displayed in a dedicated, scrollable box exclusively to the 👑 Host.

---

### 2. 🕵️‍♂️ **Codenames** (4–16 Players)
Team-based word association and deduction (Red Team vs. Blue Team).

- **Role Setup**: Red Spymaster, Blue Spymaster, and multiple Field Operatives per team with pre-game role claiming locks.
- **Gameplay**: Spymasters provide 1-word clues with a target number. Field Operatives discuss and tap word cards on their turn.
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
- **Privacy First (Cross-Platform Peek)**: Tap & Hold or Tap-to-Toggle to peek at your secret location and role with full iOS Safari/Android compatibility.
- **Cover-Typing Phase (Optional)**: 20-second disguised typing phase where innocents type assigned words and impostors type `PASS` (or submit a location guess) to avoid device physical cues.
- **Elimination Mode Setting**: Host can configure **Plurality** (highest votes eliminated; ties cancel) vs **Strict Majority** (>50% of living voters required).
- **Unanimous "No Imposters Left" Vote**: Option unlocked dynamically once enough players have been eliminated to make 0 impostors mathematically possible. **Always requires a 100% unanimous vote from all living players.**
- **Host Pacing Controls**: Host can add `+30s` or advance/skip timers anytime during discussion, cover-typing, and voting (`⏭ Skip Timer` to run down to 0).
- **Spy Knowledge Difficulty**: Category given (Standard) or Hardcore Blind (No category given to Imposters).
- **Spectator Mode**: Deceased players spectate remaining rounds with real-time voting progress.

---

## 🔒 Session Resilience, Mobile Support & Auto-Reconnection

- **⚡ Silent Auto-Reconnection**: The client automatically caches active session credentials (`party_active_room_code`, `party_last_name`, `party_last_pin`) in `localStorage`. If a player's phone sleeps, locks, or changes networks, waking the phone or switching tabs triggers an instantaneous background re-authentication that restores their exact game view and role without page reloads.
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

## 🧪 Comprehensive Automated Simulation Tests

The project includes an end-to-end automated multi-client test suite covering all 3 games, role mechanics, edge cases, and reconnect workflows:

```bash
# Run all 74 automated simulation tests
node scratch/run-all-tests.js
```

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
