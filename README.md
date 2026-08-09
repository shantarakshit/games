# Party Games Hub

A real-time, mobile-first web application for playing popular party games (Codenames, The Imposter Game) with friends over Wi-Fi or local host.

## Included Games

1. **🕵️‍♂️ Codenames**
   - Team word-guessing game.
   - Spymasters give 1-word clues to guide their field operatives to their secret agent cards.
   - Equal (8 vs 8) or Standard (9 vs 8) starting card rules.
   - Custom turn timers and soft/hard assassin rules.
   - All operatives on the active team can select cards on their turn.

2. **🕵️ The Imposter Game (Spyfall Variant)**
   - Find the hidden imposter among party guests before time runs out.
   - Tap & Hold secret role card for total privacy.
   - 20-second cover-typing phase before voting with targeted sound effects (`boo.mp3`).
   - Impostor bypass word (`PASS`) for camouflage typing.

## Host & Room Features
- **Host Role Transfer**: Transfer room host privileges to any connected player (`👑 Make Host`).
- **Lobby Player Kick**: Room hosts can remove unwanted players from the lobby (`❌ Remove`).
- **Wi-Fi QR Code Sharing**: Instant QR code scanning & Messenger link sharing for guests on the same Wi-Fi network.
- **Session Reconnection**: Reconnect cleanly to your active role and game state upon page refresh by entering your nickname.

## Getting Started

```bash
# Install dependencies
npm install

# Run dev server with auto-watch
npm run dev
```

Open `http://localhost:3000` in your browser, or share the auto-detected Wi-Fi address with players on your local network!
