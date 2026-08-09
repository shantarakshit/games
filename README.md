# Party Games Hub 🎮

A real-time, mobile-first web application for playing popular party games (**Codenames**, **The Imposter Game**) with friends over Wi-Fi or localhost — zero app downloads required!

---

## 🎲 Included Games

### 1. 🕵️‍♂️ **Codenames** (4–16 Players)
- Team word-guessing game (Red Team vs. Blue Team).
- **Player Limit**: Minimum 4 players (or 1 player for developer test mode).
- Spymasters give 1-word clues with numbers to guide field operatives.
- Operatives tap cards to reveal Agents, Bystanders, or the Assassin.
- **Multi-Operative Support**: All operatives on the active team can select cards on their turn.
- Custom turn timers, equal/standard card counts, soft/hard assassin rules.

### 2. 🕵️ **The Imposter Game (Spyfall Variant)** (3–16 Players)
- Bluffing party game where everyone knows the secret location except the Impostor(s).
- **Player Limit**: Minimum 3 players (or 1 player for developer test mode).
- **Privacy First**: Tap & Hold secret role card to peek without revealing to neighbors.
- **Optional Cover-Typing Phase**: 20-second disguised typing phase where innocents type assigned words and impostors type `PASS` to avoid suspicion (`boo.mp3` sound effect for failures). Can be toggled ON/OFF in lobby settings.
- **Host Timer Controls**: Host can add `+30s` or skip to `00:01` anytime during discussion or voting.
- **Unanimous "No Imposters Left" Vote**: Available once enough players have been voted out (`eliminatedCount >= totalSpiesCount`, e.g., 3 eliminations if 3 Imposters were configured). Requires a unanimous vote from all living players to trigger game end & full role reveal.
- **Spectator Mode**: Voted-out players remain in the room as spectators with live voting progress indicators.

---

## 👑 Host & Room Management

- **Dynamic Lobby Warning Banners**: Real-time warning banners displayed directly above the Start Game & Leave Room controls clearly inform all players of missing player count requirements (Codenames: 4+, Imposter Game: 3+) or unassigned Spymaster positions.
- **Host Privilege Transfer**: Transfer room host privileges to any connected player (`👑 Make Host`).
- **Remove Players**: Room host can kick unwanted players from the lobby (`❌ Remove`).
- **Wi-Fi & Messenger Share**: Instant QR code scanner and direct Facebook Messenger app deep-linking (`fb-messenger://share`).
- **Session Isolation**: Reconnect cleanly to your active role and game state upon page refresh using your nickname.
- **Header Player Badge**: Persistent avatar + nickname display in top header with 1-tap `(logout)` link.

---

## ⚙️ Server Reset Endpoint

To instantly restart the server, clear all rooms, disconnect all players, and assign Host privileges to the next player who connects:

- **Endpoint URL**: `http://<server-ip>:3000/api/reset` (supports `GET` or `POST`)

```bash
# Example reset command via cURL
curl -X POST http://localhost:3000/api/reset
```

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run dev server with hot reload
npm run dev
```

Open `http://localhost:3000` in your browser, or share your local Wi-Fi IP (displayed in console & header) with friends on the same network!
