const fs = require('fs');
const path = require('path');

class CodenamesInstance {
  constructor(room, emitEvent) {
    this.room = room;
    this.emitEvent = emitEvent;
    const rawTimer = (room.settings.codenames && room.settings.codenames.timerPerTurn !== undefined)
      ? Number(room.settings.codenames.timerPerTurn)
      : 120;

    this.settings = Object.assign({
      startingTeamMode: 'random',  // 'random' | 'red' | 'blue' | 'equal'
      guessLimitMode: 'clue_plus_one', // 'clue_plus_one' | 'strict' | 'unlimited'
      assassinMode: 'instant_loss',   // 'instant_loss' | 'soft'
      wordPack: 'all',                // 'all' | 'classic' | 'pop_culture' | 'food'
      timerPerTurn: isNaN(rawTimer) ? 120 : rawTimer
    }, room.settings.codenames || {});
    this.settings.timerPerTurn = isNaN(rawTimer) ? 120 : rawTimer;

    // Load and sanitize words database
    const wordsPath = path.join(__dirname, 'data/words.json');
    const rawWords = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
    this.allWords = rawWords.filter(w => typeof w === 'string' && w.trim().length > 0);

    // Spymaster Slot Lock Tracker
    this.redSpymasterId = null;
    this.blueSpymasterId = null;

    // Game State
    this.grid = [];
    this.startingTeam = 'red';
    this.currentTurn = 'red';
    this.currentRole = 'spymaster';
    this.redRemaining = 8;
    this.blueRemaining = 7;
    this.currentClue = null;
    this.winner = null;
    this.winReason = null;
    this.log = [];
    this.timerSeconds = 0;
    this.timerInterval = null;

    this.setupNewGame();
  }

  setupNewGame() {
    this.stopTurnTimer();

    // Reset Spymaster Slots for new game
    this.redSpymasterId = null;
    this.blueSpymasterId = null;

    // Reset Player Roles in room to operative
    // Preserve claimed Spymaster roles from Lobby
    for (const player of this.room.players.values()) {
      if (player.team === 'red' && player.role === 'spymaster') {
        this.redSpymasterId = player.id;
      }
      if (player.team === 'blue' && player.role === 'spymaster') {
        this.blueSpymasterId = player.id;
      }
    }

    // 1. Starting Team & Card Ratios
    if (this.settings.startingTeamMode === 'equal') {
      this.startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
      this.redRemaining = 8;
      this.blueRemaining = 8;
    } else if (this.settings.startingTeamMode === 'red') {
      this.startingTeam = 'red';
      this.redRemaining = 9;
      this.blueRemaining = 8;
    } else if (this.settings.startingTeamMode === 'blue') {
      this.startingTeam = 'blue';
      this.redRemaining = 8;
      this.blueRemaining = 9;
    } else { // 'random'
      this.startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
      this.redRemaining = this.startingTeam === 'red' ? 9 : 8;
      this.blueRemaining = this.startingTeam === 'blue' ? 9 : 8;
    }

    this.currentTurn = this.startingTeam;
    this.currentRole = 'spymaster';

    // 2. Select 25 clean words from dictionary
    const shuffledWords = [...this.allWords].sort(() => Math.random() - 0.5).slice(0, 25);

    // Build card type distribution: Red, Blue, Neutral, Assassin
    const neutralCount = this.settings.startingTeamMode === 'equal' ? 8 : 7;
    const types = [
      ...Array(this.redRemaining).fill('red'),
      ...Array(this.blueRemaining).fill('blue'),
      ...Array(neutralCount).fill('neutral'),
      'assassin'
    ].sort(() => Math.random() - 0.5);

    this.grid = shuffledWords.map((word, index) => ({
      id: index,
      word: String(word).toUpperCase().trim(),
      type: types[index],
      revealed: false
    }));

    this.currentClue = null;
    this.winner = null;
    this.winReason = null;

    const startingRuleText = this.settings.startingTeamMode === 'equal'
      ? 'Equal 8 vs 8 cards'
      : `${this.startingTeam.toUpperCase()} team starts (${this.startingTeam === 'red' ? this.redRemaining : this.blueRemaining} cards)`;
    this.log = [{
      type: 'system',
      text: `🎮 Game Started! ${startingRuleText}. 25 cards dealt. Active Spymaster: Submit your clue!`
    }];

    if (Number(this.settings.timerPerTurn) > 0) {
      this.resetTurnTimer();
    } else {
      this.timerSeconds = 0;
    }
  }

  handleAction(socketId, action, data, room, updateCallback) {
    const player = room.players.get(socketId);
    if (!player) return;

    switch (action) {
      case 'claim_spymaster':
        this.claimSpymaster(socketId, player);
        break;

      case 'set_team':
        if (data.team && (data.team === 'red' || data.team === 'blue')) {
          player.team = data.team;
          this.log.push({ type: 'system', text: `👤 ${player.name} joined ${data.team.toUpperCase()} team.` });
        }
        break;

      case 'submit_clue':
        this.submitClue(player, data.word, data.count);
        break;

      case 'guess_card':
        this.guessCard(player, data.cardId);
        break;

      case 'end_turn':
        if (this.winner) return;
        if (player.team === this.currentTurn && player.role === 'operative' && this.currentRole === 'operative' && this.currentClue) {
          this.endTurn(player, 'passed');
        } else {
          this.log.push({ type: 'warning', text: `⚠️ Only ${this.currentTurn.toUpperCase()} team's Operatives can pass the turn!` });
        }
        break;

      case 'restart_game':
        if (player.isHost) {
          this.log.push({ type: 'system', text: `🔄 Game restarted by ${player.name}. Shuffling 25 new cards!` });
          this.setupNewGame();
        }
        break;
    }

    if (updateCallback) updateCallback();
  }

  claimSpymaster(socketId, player) {
    if (this.winner) return;

    const team = player.team || 'red';
    if (team === 'red') {
      if (this.redSpymasterId === null || this.redSpymasterId === socketId) {
        for (const p of this.room.players.values()) {
          if (p.team === 'red' && p.role === 'spymaster') p.role = 'operative';
        }
        this.redSpymasterId = socketId;
        player.role = 'spymaster';
        this.log.push({ type: 'system', text: `🕵️‍♂️ ${player.name} claimed RED SPYMASTER position! (Locked for this match)` });
      } else {
        const currentOwner = this.room.players.get(this.redSpymasterId);
        this.log.push({ type: 'warning', text: `⚠️ RED Spymaster slot is already locked by ${currentOwner ? currentOwner.name : 'someone'}!` });
      }
    } else if (team === 'blue') {
      if (this.blueSpymasterId === null || this.blueSpymasterId === socketId) {
        for (const p of this.room.players.values()) {
          if (p.team === 'blue' && p.role === 'spymaster') p.role = 'operative';
        }
        this.blueSpymasterId = socketId;
        player.role = 'spymaster';
        this.log.push({ type: 'system', text: `🕵️‍♂️ ${player.name} claimed BLUE SPYMASTER position! (Locked for this match)` });
      } else {
        const currentOwner = this.room.players.get(this.blueSpymasterId);
        this.log.push({ type: 'warning', text: `⚠️ BLUE Spymaster slot is already locked by ${currentOwner ? currentOwner.name : 'someone'}!` });
      }
    }
  }

  submitClue(player, word, count) {
    if (this.winner) return;

    // STRICT TURN ENFORCEMENT: Only active team's Spymaster during spymaster phase
    if (player.team !== this.currentTurn) {
      this.log.push({ type: 'warning', text: `⚠️ Not your team's turn! It is ${this.currentTurn.toUpperCase()} team's turn.` });
      return;
    }
    if (this.currentRole !== 'spymaster' || player.role !== 'spymaster') {
      this.log.push({ type: 'warning', text: `⚠️ Only Spymasters can submit clues during Spymaster phase!` });
      return;
    }
    if (!word || typeof count !== 'number' || count < 0) return;

    let allowedGuesses = count + 1; // default clue_plus_one
    if (this.settings.guessLimitMode === 'strict') allowedGuesses = count;
    if (this.settings.guessLimitMode === 'unlimited' || count === 0) allowedGuesses = 99;

    this.currentClue = {
      word: word.toUpperCase().trim(),
      count,
      guessesLeft: allowedGuesses
    };

    this.currentRole = 'operative';
    this.log.push({
      type: 'clue',
      team: player.team,
      text: `💡 ${player.name} (${player.team.toUpperCase()} Spymaster) gave clue: "${this.currentClue.word}" for ${count === 0 ? 'Unlimited' : count}`
    });

    this.resetTurnTimer();
  }

  guessCard(player, cardId) {
    if (this.winner) return;

    // STRICT SPYMASTER BLOCK: Spymasters can NEVER select cards on behalf of players
    if (player.role === 'spymaster') {
      this.log.push({ type: 'warning', text: `⚠️ ${player.name} (Spymaster) cannot select cards! Only Operatives can guess.` });
      return;
    }

    // STRICT TURN ENFORCEMENT: Only active team's Operatives during operative phase
    if (player.team !== this.currentTurn) {
      this.log.push({ type: 'warning', text: `⚠️ Not your team's turn! Wait for ${this.currentTurn.toUpperCase()} team.` });
      return;
    }
    if (this.currentRole !== 'operative') {
      this.log.push({ type: 'warning', text: `⚠️ Wait for Spymaster to submit a clue!` });
      return;
    }
    if (!this.currentClue) {
      this.log.push({ type: 'warning', text: `⚠️ Wait for your Spymaster to give a clue first!` });
      return;
    }

    const card = this.grid.find(c => c.id === cardId);
    if (!card || card.revealed) return;

    card.revealed = true;

    // Determine audio feedback type for clients
    let soundType = 'wrong';
    if (card.type === 'assassin') {
      soundType = 'assassin';
    } else if (card.type === player.team) {
      soundType = 'correct';
    }
    this.emitEvent('codenames_card_sound', { sound: soundType });

    if (card.type === 'red') this.redRemaining--;
    if (card.type === 'blue') this.blueRemaining--;

    this.log.push({
      type: 'guess',
      team: player.team,
      text: `👆 ${player.name} tapped "${card.word}" (${card.type.toUpperCase()})`
    });

    // Check Assassin Card
    if (card.type === 'assassin') {
      if (this.settings.assassinMode === 'soft') {
        this.log.push({ type: 'warning', text: `💥 SOFT ASSASSIN REVEALED! ${player.team.toUpperCase()} team ends turn and loses a point.` });
        if (player.team === 'red') this.redRemaining++;
        else this.blueRemaining++;
        this.endTurn(player, 'assassin');
        return;
      } else {
        this.winner = player.team === 'red' ? 'blue' : 'red';
        this.winReason = 'assassin';
        this.stopTurnTimer();
        this.log.push({ type: 'gameover', text: `💥 ASSASSIN CARD REVEALED! ${this.winner.toUpperCase()} team wins!` });
        return;
      }
    }

    // Check Win Conditions
    if (this.redRemaining === 0) {
      this.winner = 'red';
      this.winReason = 'all-found';
      this.stopTurnTimer();
      this.log.push({ type: 'gameover', text: '🏆 RED team revealed all cards and WON!' });
      return;
    }

    if (this.blueRemaining === 0) {
      this.winner = 'blue';
      this.winReason = 'all-found';
      this.stopTurnTimer();
      this.log.push({ type: 'gameover', text: '🏆 BLUE team revealed all cards and WON!' });
      return;
    }

    // Wrong team card or neutral card -> end turn
    if (card.type !== player.team) {
      this.endTurn(player, 'wrong_guess');
    } else {
      if (this.currentClue) {
        this.currentClue.guessesLeft--;
        if (this.currentClue.guessesLeft <= 0) {
          this.endTurn(player, 'out_of_guesses');
        }
      }
    }
  }

  endTurn(player, reason) {
    if (reason === 'passed' && player.team !== this.currentTurn) return;

    const nextTeam = this.currentTurn === 'red' ? 'blue' : 'red';
    this.currentTurn = nextTeam;
    this.currentRole = 'spymaster';
    this.currentClue = null;
    this.stopTurnTimer();

    if (reason === 'passed') {
      this.log.push({ type: 'turn', text: `⏳ ${player.team ? player.team.toUpperCase() : 'Current'} team passed their turn. Now ${nextTeam.toUpperCase()} team's turn.` });
    } else if (reason === 'wrong_guess') {
      this.log.push({ type: 'turn', text: `❌ Wrong guess! Turn ended. Now ${nextTeam.toUpperCase()} team's turn.` });
    } else if (reason === 'out_of_guesses') {
      this.log.push({ type: 'turn', text: `🎯 All clues guessed! Turn completed. Now ${nextTeam.toUpperCase()} team's turn.` });
    } else if (reason === 'timeout') {
      this.log.push({ type: 'turn', text: `⏱️ Turn Timer Expired! Turn passed to ${nextTeam.toUpperCase()} team.` });
    } else if (reason === 'assassin') {
      this.log.push({ type: 'turn', text: `💥 Soft Assassin penalty applied! Turn passed to ${nextTeam.toUpperCase()} team.` });
    }

    if (Number(this.settings.timerPerTurn) > 0) {
      this.resetTurnTimer();
    } else {
      this.timerSeconds = 0;
    }
  }

  resetTurnTimer() {
    this.stopTurnTimer();
    const duration = (this.settings.timerPerTurn !== undefined && this.settings.timerPerTurn !== null)
      ? Number(this.settings.timerPerTurn)
      : 120;
    if (isNaN(duration) || duration <= 0) {
      this.timerSeconds = 0;
      return;
    }

    this.timerSeconds = duration;
    this.emitEvent('timer_tick', { timerSeconds: this.timerSeconds });

    this.timerInterval = setInterval(() => {
      if (this.timerSeconds > 0) {
        this.timerSeconds--;
        this.emitEvent('timer_tick', { timerSeconds: this.timerSeconds });
      } else {
        this.stopTurnTimer();
        this.emitEvent('codenames_timer_expired', { team: this.currentTurn, role: this.currentRole });
        const dummyPlayer = { team: this.currentTurn };
        this.endTurn(dummyPlayer, 'timeout');
        this.emitEvent('game_state_updated');
      }
    }, 1000);
  }

  stopTurnTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  reconnectPlayer(oldSocketId, newSocketId) {
    if (this.redSpymasterId === oldSocketId) {
      this.redSpymasterId = newSocketId;
    }
    if (this.blueSpymasterId === oldSocketId) {
      this.blueSpymasterId = newSocketId;
    }
  }

  getPlayerState(socketId, player, room) {
    const isSpymaster = player.role === 'spymaster';

    // Build client grid: all 25 cards with words & reveal status
    const clientGrid = this.grid.map(card => ({
      id: card.id,
      word: card.word,
      revealed: card.revealed,
      type: (card.revealed || isSpymaster || this.winner) ? card.type : null
    }));

    return {
      gameId: 'codenames',
      grid: clientGrid,
      keycard: (isSpymaster || this.winner) ? this.grid.map(c => ({ id: c.id, type: c.type })) : null,
      startingTeam: this.startingTeam,
      currentTurn: this.currentTurn,
      currentRole: this.currentRole,
      redRemaining: this.redRemaining,
      blueRemaining: this.blueRemaining,
      redSpymasterClaimed: this.redSpymasterId !== null,
      blueSpymasterClaimed: this.blueSpymasterId !== null,
      currentClue: this.currentClue,
      winner: this.winner,
      winReason: this.winReason,
      log: this.log,
      settings: this.settings,
      timerSeconds: this.timerSeconds,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        team: p.team,
        role: p.role,
        isHost: p.isHost
      })),
      myPlayer: {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        team: player.team,
        role: player.role,
        isHost: player.isHost
      }
    };
  }

  destroy() {
    this.stopTurnTimer();
  }
}

module.exports = CodenamesInstance;
