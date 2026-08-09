const fs = require('fs');
const path = require('path');

class SpyInstance {
  constructor(room, emitEvent) {
    this.room = room;
    this.emitEvent = emitEvent;
    this.settings = Object.assign({
      spiesCount: 1,
      spyKnowledgeMode: 'category', // 'category' | 'blind' | 'hints'
      timer: 300
    }, room.settings.spy || {});

    // Load categories database
    const catPath = path.join(__dirname, 'data/categories.json');
    this.allData = JSON.parse(fs.readFileSync(catPath, 'utf8'));

    // Game state
    this.category = null;
    this.location = null;
    this.possibleLocations = [];
    this.spies = [];
    this.playerRoles = new Map();

    this.phase = 'discussion'; // 'discussion' | 'voting' | 'tally' | 'ended'
    this.timerSeconds = 300;
    this.timerInterval = null;

    this.votes = new Map(); // voterSocketId -> targetSocketId
    this.usedSpyGuess = new Set(); // socketIds of spies who used their 1 guess
    this.eliminatedPlayers = new Set(); // socketIds of eliminated/ousted players
    this.camouflageWords = new Map(); // socketId -> 8-12 letter word
    this.completedCamouflage = new Set(); // socketIds of innocents who finished camouflage typing

    this.tallyData = [];
    this.tallyResultText = '';
    this.winner = null;
    this.winReason = null;
    this.log = [];

    this.setupNewGame();
  }

  setupNewGame() {
    this.stopTimer();

    // 1. Pick Category & Secret Word
    const categoryItem = this.allData[Math.floor(Math.random() * this.allData.length)];
    this.category = categoryItem.category;

    const rawWords = categoryItem.words || categoryItem.locations || [];
    this.possibleLocations = rawWords.map(w => typeof w === 'string' ? w : w.name);

    this.location = this.possibleLocations[Math.floor(Math.random() * this.possibleLocations.length)];

    // 2. Select Spy(s)
    const playersList = Array.from(this.room.players.keys());
    const count = Math.min(this.settings.spiesCount || 1, Math.max(1, Math.floor(playersList.length / 2)));

    const shuffledSockets = [...playersList].sort(() => Math.random() - 0.5);
    this.spies = shuffledSockets.slice(0, count);

    // 3. Assign Roles
    this.playerRoles.clear();
    playersList.forEach((socketId) => {
      const isSpy = this.spies.includes(socketId);
      const role = isSpy ? 'The Impostor / Spy' : 'Innocent';
      this.playerRoles.set(socketId, { isSpy, role });
    });

    this.votes.clear();
    this.usedSpyGuess.clear();
    this.eliminatedPlayers.clear();
    this.camouflageWords.clear();
    this.completedCamouflage.clear();
    this.tallyData = [];
    this.tallyResultText = '';
    this.winner = null;
    this.winReason = null;

    const spyModeText = this.settings.spyKnowledgeMode === 'blind' ? 'BLIND SPY (No Category)' : 'STANDARD SPY (Category Only)';
    this.log = [{
      type: 'system',
      text: `🕵️ Game Started! Spies: ${this.spies.length}. Mode: ${spyModeText}.`
    }];

    this.startDiscussionPhase();
  }

  startDiscussionPhase() {
    this.stopTimer();
    this.phase = 'discussion';
    this.timerSeconds = this.settings.timer > 0 ? this.settings.timer : 300;
    this.votes.clear();
    this.log.push({ type: 'system', text: '💬 Discussion phase started! Ask questions to find the Imposter.' });
    this.startTimer();
    this.emitEvent('game_state_updated');
  }

  startTypingGuessPhase() {
    this.stopTimer();
    this.phase = 'typing_guess';
    this.timerSeconds = 20; // 20-second cover typing phase before voting
    this.camouflageWords.clear();
    this.completedCamouflage.clear();

    const wordsPool = [
      'PARACHUTE', 'DANDELION', 'STETHOSCOPE', 'LIGHTHOUSE',
      'TELESCOPE', 'ASTRONAUT', 'CHAMELEON', 'EQUALIZER',
      'DICTIONARY', 'CAMPGROUND', 'SUNFLOWER', 'BUTTERFLY',
      'BLUEBERRY', 'CHOCOLATE', 'AVALANCHE', 'SPAGHETTI',
      'FIREWORKS', 'HELIOPORT', 'HANDSHAKE', 'WATERMELON',
      'BASKETBALL', 'REFRIGERATOR'
    ];

    for (const socketId of this.room.players.keys()) {
      if (!this.eliminatedPlayers.has(socketId)) {
        if (this.spies.includes(socketId)) {
          this.camouflageWords.set(socketId, 'PASS');
        } else {
          const randomWord = wordsPool[Math.floor(Math.random() * wordsPool.length)];
          this.camouflageWords.set(socketId, randomWord);
        }
      }
    }

    this.log.push({ type: 'warning', text: '⌨️ 20-Second Cover-Typing Phase initiated! Everyone type on your device!' });
    this.startTimer();
    this.emitEvent('game_state_updated');
  }

  startVotingPhase() {
    this.stopTimer();
    this.phase = 'voting';
    this.timerSeconds = 60; // 1 min voting time
    this.votes.clear();
    this.log.push({ type: 'warning', text: '🗳️ 1-minute voting phase initiated. Cast your vote!' });
    this.startTimer();
    this.emitEvent('game_state_updated');
  }

  startTallyPhase() {
    this.stopTimer();
    this.phase = 'tally';
    this.timerSeconds = 10; // 10 seconds tally screen

    // Calculate Votes for living non-eliminated players
    const livingPlayers = Array.from(this.room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
    const voteCounts = new Map();
    livingPlayers.forEach(id => voteCounts.set(id, 0));

    for (const [voterId, targetId] of this.votes.entries()) {
      if (!this.eliminatedPlayers.has(voterId) && voteCounts.has(targetId)) {
        voteCounts.set(targetId, voteCounts.get(targetId) + 1);
      }
    }

    // Find max votes
    let maxVotes = 0;
    let accusedId = null;
    let isTie = false;

    for (const [id, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        accusedId = id;
        isTie = false;
      } else if (count === maxVotes && count > 0) {
        isTie = true;
      }
    }

    if (!isTie && accusedId && maxVotes > 0) {
      const accusedPlayer = this.room.players.get(accusedId);
      const isSpy = this.spies.includes(accusedId);
      this.eliminatedPlayers.add(accusedId);

      if (isSpy) {
        this.spies = this.spies.filter(id => id !== accusedId);
        if (this.spies.length === 0) {
          this.winner = 'innocents';
          this.winReason = 'all-spies-eliminated';
          this.tallyResultText = `💥 ${accusedPlayer ? accusedPlayer.name : 'Someone'} was voted out! They WERE the last Impostor! Game Over!`;
        } else {
          const remainingLiving = livingPlayers.filter(id => id !== accusedId);
          const livingSpies = this.spies.filter(id => !this.eliminatedPlayers.has(id));
          const livingInnocents = remainingLiving.length - livingSpies.length;

          if (livingSpies.length >= livingInnocents) {
            this.winner = 'impostors';
            this.winReason = 'impostors-majority';
            this.tallyResultText = `🕵️ ${accusedPlayer ? accusedPlayer.name : 'Someone'} was voted out! Impostors have reached majority! Game Over!`;
          } else {
            // Voted out an impostor, but NOT the last impostor! Role is not revealed.
            this.tallyResultText = `👤 ${accusedPlayer ? accusedPlayer.name : 'Someone'} was voted out!`;
          }
        }
      } else {
        const remainingLiving = livingPlayers.filter(id => id !== accusedId);
        const livingSpies = this.spies.filter(id => !this.eliminatedPlayers.has(id));
        const livingInnocents = remainingLiving.length - livingSpies.length;

        if (livingSpies.length >= livingInnocents) {
          this.winner = 'impostors';
          this.winReason = 'impostors-majority';
          this.tallyResultText = `🕵️ ${accusedPlayer ? accusedPlayer.name : 'Someone'} was voted out! Impostors have reached majority! Game Over!`;
        } else {
          // Innocent voted out! Role is not revealed.
          this.tallyResultText = `👤 ${accusedPlayer ? accusedPlayer.name : 'Someone'} was voted out!`;
        }
      }
    } else {
      this.tallyResultText = '⚖️ It was a tie! No one was eliminated.';
    }

    // Prepare Tally Data (only include isSpy flag if game is over)
    this.tallyData = livingPlayers.map(id => {
      const p = this.room.players.get(id);
      return {
        id,
        name: p ? p.name : 'Player',
        avatar: p ? p.avatar : '😎',
        votesReceived: voteCounts.get(id) || 0,
        isSpy: this.winner ? this.spies.includes(id) : undefined
      };
    });

    this.log.push({ type: 'vote', text: `📊 ${this.tallyResultText}` });
    this.startTimer();
    this.emitEvent('game_state_updated');
  }

  startTimer() {
    this.stopTimer();
    this.emitEvent('timer_tick', { timerSeconds: this.timerSeconds, phase: this.phase });

    this.timerInterval = setInterval(() => {
      if (this.timerSeconds > 0) {
        this.timerSeconds--;
        this.emitEvent('timer_tick', { timerSeconds: this.timerSeconds, phase: this.phase });
      } else {
        this.onTimerExpired();
      }
    }, 1000);
  }

  onTimerExpired() {
    this.stopTimer();
    if (this.phase === 'discussion') {
      this.startTypingGuessPhase();
    } else if (this.phase === 'typing_guess') {
      const uncompletedSockets = [];
      for (const socketId of this.room.players.keys()) {
        if (!this.eliminatedPlayers.has(socketId) && !this.completedCamouflage.has(socketId)) {
          uncompletedSockets.push(socketId);
        }
      }
      if (uncompletedSockets.length > 0) {
        this.emitEvent('play_boo_sound_targeted', { targetSockets: uncompletedSockets });
      }
      this.startVotingPhase();
    } else if (this.phase === 'voting') {
      this.startTallyPhase();
    } else if (this.phase === 'tally') {
      if (this.winner) {
        this.phase = 'ended';
        this.emitEvent('game_state_updated');
      } else {
        this.startDiscussionPhase();
      }
    }
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  handleAction(socketId, action, data, room, updateCallback) {
    const player = room.players.get(socketId);
    if (!player) return;

    switch (action) {
      case 'submit_camouflage_typing':
        if (this.phase === 'typing_guess' && !this.spies.includes(socketId) && !this.eliminatedPlayers.has(socketId)) {
          const expected = this.camouflageWords.get(socketId);
          const typed = String(data.word || '').trim().toUpperCase();
          if (expected && typed === expected) {
            this.completedCamouflage.add(socketId);
            this.emitEvent('game_state_updated');
          }
        }
        break;

      case 'submit_vote':
        if (this.phase === 'voting' && !this.eliminatedPlayers.has(socketId) && data.targetId) {
          if (!this.eliminatedPlayers.has(data.targetId)) {
            this.votes.set(socketId, data.targetId);
            const targetPlayer = room.players.get(data.targetId);
            this.log.push({ type: 'vote', text: `👤 ${player.name} submitted their vote.` });

            // Check if all living connected players have voted
            const livingPlayers = Array.from(room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
            if (this.votes.size >= livingPlayers.length) {
              this.startTallyPhase();
            }
          }
        }
        break;

      case 'spy_guess_location':
        this.spyGuessLocation(socketId, data.location);
        break;

      case 'restart_game':
        if (player.isHost) {
          this.setupNewGame();
        }
        break;
    }

    if (updateCallback) updateCallback();
  }

  spyGuessLocation(socketId, guessedLocation) {
    if (!this.spies.includes(socketId) || this.eliminatedPlayers.has(socketId) || this.winner) return;

    const normGuess = String(guessedLocation || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const expectedBypass = String(this.camouflageWords.get(socketId) || 'pass').trim().toLowerCase();

    // Check if Impostor entered bypass word (case-insensitive "pass", "bypass", or assigned bypass word)
    if (normGuess === 'pass' || normGuess === 'bypass' || normGuess === expectedBypass) {
      this.completedCamouflage.add(socketId);
      this.emitEvent('game_state_updated');
      return;
    }

    if (this.usedSpyGuess.has(socketId)) return;
    this.usedSpyGuess.add(socketId);
    this.completedCamouflage.add(socketId);

    const spyPlayer = this.room.players.get(socketId);
    const normActual = String(this.location || '').trim().toLowerCase().replace(/\s+/g, ' ');

    if (normGuess === normActual) {
      this.stopTimer();
      this.winner = 'impostors';
      this.winReason = 'spy-guessed-correct';
      this.phase = 'ended';
      this.log.push({ type: 'gameover', text: `🎯 SPY WIN! ${spyPlayer ? spyPlayer.name : 'The Impostor'} correctly guessed the word: "${this.location}"!` });
      this.emitEvent('game_state_updated');
    } else {
      // Wrong guess: Oust this imposter!
      this.eliminatedPlayers.add(socketId);
      this.spies = this.spies.filter(id => id !== socketId);
      this.log.push({ type: 'warning', text: `❌ SPY FAIL! ${spyPlayer ? spyPlayer.name : 'The Impostor'} guessed "${guessedLocation}", which was WRONG! ${spyPlayer ? spyPlayer.name : 'The Impostor'} is ousted!` });

      if (this.spies.length === 0) {
        this.stopTimer();
        this.winner = 'innocents';
        this.winReason = 'all-spies-eliminated';
        this.phase = 'ended';
      } else {
        const livingPlayers = Array.from(this.room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
        const livingSpies = this.spies.filter(id => !this.eliminatedPlayers.has(id));
        const livingInnocents = livingPlayers.length - livingSpies.length;
        if (livingSpies.length >= livingInnocents) {
          this.stopTimer();
          this.winner = 'impostors';
          this.winReason = 'impostors-majority';
          this.phase = 'ended';
        }
      }
      this.emitEvent('game_state_updated');
    }
  }

  reconnectPlayer(oldSocketId, newSocketId) {
    const spyIdx = this.spies.indexOf(oldSocketId);
    if (spyIdx !== -1) {
      this.spies[spyIdx] = newSocketId;
    }

    if (this.playerRoles.has(oldSocketId)) {
      const roleData = this.playerRoles.get(oldSocketId);
      this.playerRoles.delete(oldSocketId);
      this.playerRoles.set(newSocketId, roleData);
    }

    if (this.usedSpyGuess.has(oldSocketId)) {
      this.usedSpyGuess.delete(oldSocketId);
      this.usedSpyGuess.add(newSocketId);
    }

    if (this.eliminatedPlayers.has(oldSocketId)) {
      this.eliminatedPlayers.delete(oldSocketId);
      this.eliminatedPlayers.add(newSocketId);
    }

    if (this.votes.has(oldSocketId)) {
      const target = this.votes.get(oldSocketId);
      this.votes.delete(oldSocketId);
      this.votes.set(newSocketId, target === oldSocketId ? newSocketId : target);
    }

    if (this.camouflageWords.has(oldSocketId)) {
      const word = this.camouflageWords.get(oldSocketId);
      this.camouflageWords.delete(oldSocketId);
      this.camouflageWords.set(newSocketId, word);
    }

    if (this.completedCamouflage.has(oldSocketId)) {
      this.completedCamouflage.delete(oldSocketId);
      this.completedCamouflage.add(newSocketId);
    }
  }

  getPlayerState(socketId, player, room) {
    const roleInfo = this.playerRoles.get(socketId) || { isSpy: false, role: 'Innocent' };
    const isSpy = roleInfo.isSpy;
    const isEliminated = this.eliminatedPlayers.has(socketId);

    let displayCategory = this.category;
    let displayLocation = this.location;

    if (isSpy && !this.winner) {
      if (this.settings.spyKnowledgeMode === 'blind') {
        displayCategory = '❓ BLIND SPY (No Category)';
      }
      displayLocation = '❓ SECRET (You are the Spy!)';
    }

    const livingPlayers = Array.from(room.players.keys())
      .filter(id => !this.eliminatedPlayers.has(id))
      .map(id => {
        const p = room.players.get(id);
        return { id, name: p ? p.name : 'Player', avatar: p ? p.avatar : '😎' };
      });

    return {
      gameId: 'spy',
      category: displayCategory,
      location: displayLocation,
      role: roleInfo.role,
      isSpy,
      isEliminated,
      hasVoted: this.votes.has(socketId),
      hasGuessed: this.usedSpyGuess.has(socketId),
      camouflageWord: !isSpy ? this.camouflageWords.get(socketId) : null,
      camouflageCompleted: !isSpy ? this.completedCamouflage.has(socketId) : false,
      phase: this.phase,
      possibleLocations: this.possibleLocations,
      timerSeconds: this.timerSeconds,
      tallyData: this.phase === 'tally' ? this.tallyData : [],
      tallyResultText: this.tallyResultText,
      livingPlayers,
      votesCount: this.votes.size,
      totalLivingPlayers: livingPlayers.length,
      winner: this.winner,
      winReason: this.winReason,
      log: this.log,
      settings: this.settings,
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
    this.stopTimer();
  }
}

class SpyPlugin {
  constructor() {
    this.id = 'spy';
    this.name = 'The Imposter Game';
    this.description = 'Find the hidden imposter among your party guests before time runs out!';
    this.icon = '🕵️';
    this.minPlayers = 1;
    this.maxPlayers = 16;
    this.category = 'Bluffing / Party Game';
    this.settingsSchema = [
      {
        id: 'spiesCount',
        label: 'Number of Spies',
        type: 'select',
        options: [
          { value: 1, label: '1 Spy (Standard)' },
          { value: 2, label: '2 Spies (Suggested for 8+ players)' },
          { value: 3, label: '3 Spies (Suggested for 12+ players)' }
        ],
        default: 1,
        description: 'Multiple Spies adds chaos and teamwork for larger groups.'
      },
      {
        id: 'spyKnowledgeMode',
        label: 'Spy Difficulty / Knowledge',
        type: 'select',
        options: [
          { value: 'category', label: 'Category Given (Standard)' },
          { value: 'blind', label: 'Hardcore Blind (No Category)' }
        ],
        default: 'category',
        description: 'Hardcore Blind mode gives the spy zero category info for maximum challenge.'
      },
      {
        id: 'timer',
        label: 'Discussion Timer',
        type: 'select',
        options: [
          { value: 120, label: '2 Minutes (Fast)' },
          { value: 180, label: '3 Minutes (Standard)' },
          { value: 300, label: '5 Minutes (Casual)' }
        ],
        default: 120,
        description: 'Timer duration for asking questions before mandatory 1-minute voting.'
      }
    ];
  }

  createInstance(room, emitEvent) {
    return new SpyInstance(room, emitEvent);
  }
}

module.exports = SpyPlugin;
