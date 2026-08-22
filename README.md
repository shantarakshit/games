# Party Games Hub 🎮

A real-time, local-first, multi-device web application for playing popular party games (**Mafia**, **Codenames**, and **The Imposter Game / Spyfall**) with friends over Wi-Fi or localhost — zero app store downloads required!

---

## 🎲 Included Games

### 1. 🔪 **Mafia** (6–18 Players)
The classic social deduction game of deception, investigation, protection, and survival.

- **Roles & Distribution**:
  - **👑 Host / Narrator**: Controls game pacing, reads prompts, sees all player roles in real-time God-mode, and accesses the live Secret Action Ledger.
  - **🔪 Murderers (1–3 players)**: Secretly coordinate during the night, vote and swap targets in real-time with visual consensus confirmation.
  - **💉 Doctor (1 player)**: Protects 1 living player each night (including themselves). Cannot protect the same player two rounds in a row.
  - **🔍 Detective (1 player)**: Investigates 1 living suspect each night (not themselves or Host) to discover if they are a Murderer. Maintains a personal in-game Detective Notebook.
  - **😇 Civilians (Townspeople)**: Sleep at night, debate during daytime, and vote to eliminate suspected murderers.
- **Night Sequence & Privacy**:
  - **Silent Player Actions**: All sound effects on player devices during night selection are suppressed to prevent physical sound cues in the room.
  - **Deceased Role Bypass**: If Doctor or Detective are eliminated, the game seamlessly bypasses their turn.
- **Daytime Voting & Elimination**:
  - **Live Anonymous Vote Tallies**: During daytime voting, candidate cards show live anonymous vote counts (`🗳️ 0 votes`, `🗳️ 1 vote`, `🗳️ 2 votes`) updating in real-time without revealing voter identities.
  - **Self-Vote Prevention**: Players cannot vote for themselves.
  - **Strict Majority Elimination**: Eliminating a suspect requires a strict majority ($\lfloor \frac{\text{living}}{2} \rfloor + 1$). If no suspect achieves a strict majority, the town enters night without an execution.
  - **Spectator Experience**: Eliminated players remain in the room as Spectators, watching live voting tallies, morning stories, and end-game statistics.
- **Win Conditions**:
  - **🏆 Civilians Win**: When all Murderers are successfully eliminated.
  - **🏆 Mafia Wins**: When living Murderers equal or outnumber living Civilians ($\ge$).
- **End-Game Timeline Ledger**: Complete match history detailing night targets, saves, investigations, and daytime elimination votes.

---

### 2. 🕵️‍♂️ **Codenames** (4–16 Players)
Team-based word association and deduction (Red Team vs. Blue Team).

- **Role Setup**: Red Spymaster, Blue Spymaster, and multiple Field Operatives per team.
- **Gameplay**: Spymasters provide 1-word clues with a target number. Field Operatives discuss and tap word cards on their turn.
- **Card Types**: Team Agents (Red/Blue), Innocent Bystanders (Neutral), and the sudden-death Assassin card.
- **Customization**: Equal/standard card counts, turn timers, and soft/hard assassin rules.

---

### 3. 🕵️ **The Imposter Game (Spyfall Variant)** (3–16 Players)
A high-stakes bluffing game where everyone knows the secret location except the Imposter(s).

- **Privacy First**: Tap & Hold to peek at your secret location and role without revealing it to adjacent players.
- **Optional Cover-Typing Phase**: 20-second disguised typing phase where innocents type assigned words and impostors type `PASS` to avoid suspicion.
- **Host Controls**: Host can add `+30s` or skip timers anytime during discussion and voting.
- **Unanimous "No Imposters Left" Vote**: Option unlocked once enough players have been voted out to conclude the match.
- **Spectator Mode**: Deceased players spectate remaining rounds with real-time voting progress.

---

## 👑 Host & Room Management

- **Lobby Warning Banners**: Real-time lobby alerts dynamically indicate missing player count thresholds or unassigned essential roles before starting.
- **Host Transfer**: Transfer room host privileges to any connected player (`👑 Make Host`).
- **Kick Players**: Room host can remove unwanted or inactive connections from the lobby (`❌ Remove`).
- **QR Code & Share Link**: Automatic QR code generation and direct Facebook Messenger app deep-linking (`fb-messenger://share`).
- **Session Reconnection**: Reconnect cleanly to your active role and match state upon page refresh using your nickname.
- **Header Badges**: Persistent avatar, nickname, room code, and host indicator in the top navigation bar.

---

## ⚙️ Server Reset Endpoint

To instantly restart the server state, clear all rooms, disconnect lingering clients, and assign Host privileges to the next player who connects:

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

# 2. Start the production server
npm start

# Or run with live file watching for development
npm run dev
```

Open `http://localhost:3000` in your browser, or connect devices on the same Wi-Fi network using the local network URL displayed in the server terminal and header.

---

## 📦 Production Deployment

The project is built with Vanilla HTML5, CSS3, and Node.js / Express / Socket.io with zero complex build steps.

To deploy on any cloud VM or container service (AWS EC2, DigitalOcean, Render, Fly.io, Railway):

```bash
# Set environment variables (optional)
PORT=3000
PUBLIC_URL=https://your-domain.com

# Start the server
npm start
```
