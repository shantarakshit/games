const fs = require('fs');
const path = require('path');

class SpyInstance {
  constructor(room, emitEvent) {
    this.room = room;
    this.emitEvent = emitEvent;
    const spySettings = room.settings.spy || {};
    const isCoverTyping = spySettings.coverTyping !== undefined
      ? (spySettings.coverTyping === true || spySettings.coverTyping === 'true')
      : true;
    const rawTimer = spySettings.timer !== undefined ? Number(spySettings.timer) : 180;

    this.settings = Object.assign({
      spiesCount: 1,
      spyKnowledgeMode: 'category', // 'category' | 'blind' | 'hints'
      timer: isNaN(rawTimer) ? 180 : rawTimer,
      coverTyping: isCoverTyping,
      eliminationMode: 'plurality' // 'plurality' | 'majority'
    }, spySettings);
    this.settings.coverTyping = isCoverTyping;
    this.settings.timer = isNaN(rawTimer) ? 180 : rawTimer;
    this.settings.eliminationMode = spySettings.eliminationMode || 'plurality';

    // Load categories database
    const catPath = path.join(__dirname, 'data/categories.json');
    this.allData = JSON.parse(fs.readFileSync(catPath, 'utf8'));

    // Game state
    this.category = null;
    this.location = null;
    this.possibleLocations = [];
    this.spies = [];
    this.playerRoles = new Map();

    this.phase = 'discussion'; // 'discussion' | 'typing_guess' | 'voting' | 'tally' | 'ended'
    this.timerSeconds = 300;
    this.timerInterval = null;

    this.votes = new Map(); // voterSocketId -> targetSocketId
    this.usedSpyGuess = new Set(); // socketIds of spies who used their 1 guess
    this.eliminatedPlayers = new Set(); // socketIds of eliminated/ousted players
    this.camouflageWords = new Map(); // socketId -> 8-12 letter word
    this.completedCamouflage = new Set(); // socketIds of innocents who finished camouflage typing
    this.starterPlayerId = null; // socketId of the player chosen to ask first question

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
    this.starterPlayerId = null;
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
    const duration = (this.settings.timer !== undefined && this.settings.timer !== null) ? Number(this.settings.timer) : 180;
    this.timerSeconds = isNaN(duration) ? 180 : duration;
    this.votes.clear();

    // Randomly choose a living player (spy or non-spy) to start the discussion
    const livingPlayers = Array.from(this.room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
    if (livingPlayers.length > 0) {
      this.starterPlayerId = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
      const starterPlayer = this.room.players.get(this.starterPlayerId);
      const starterName = starterPlayer ? starterPlayer.name : 'A player';
      this.log.push({
        type: 'system',
        text: `💬 Discussion phase started! 🎤 ${starterName} was chosen to start the discussion.`
      });
    } else {
      this.starterPlayerId = null;
      this.log.push({ type: 'system', text: '💬 Discussion phase started! Ask questions to find the Imposter.' });
    }

    if (this.timerSeconds > 0) {
      this.startTimer();
    } else {
      this.timerSeconds = 0;
    }
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
    const isUntimed = this.settings && Number(this.settings.timer) === 0;
    this.timerSeconds = isUntimed ? 0 : 60; // Untimed or 1 min voting time
    this.votes.clear();
    if (this.timerSeconds > 0) {
      this.log.push({ type: 'warning', text: '🗳️ 1-minute voting phase initiated. Cast your vote!' });
      this.startTimer();
    } else {
      this.timerSeconds = 0;
      this.log.push({ type: 'warning', text: '🗳️ Voting phase open (No Timer). Cast your vote!' });
    }
    this.emitEvent('game_state_updated');
  }

  startTallyPhase() {
    this.stopTimer();
    this.phase = 'tally';
    this.timerSeconds = 10;

    // Calculate Votes for living non-eliminated players
    const livingPlayers = Array.from(this.room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
    const voteCounts = new Map();
    livingPlayers.forEach(id => voteCounts.set(id, 0));

    for (const [voterId, targetId] of this.votes.entries()) {
      if (!this.eliminatedPlayers.has(voterId) && voteCounts.has(targetId)) {
        voteCounts.set(targetId, voteCounts.get(targetId) + 1);
      }
    }

    // Check unanimous "No Imposters Left" vote (all living players)
    const noImpVotes = Array.from(this.votes.values()).filter(v => v === 'NO_IMPOSTERS').length;
    if (noImpVotes >= livingPlayers.length && livingPlayers.length > 0) {
      // Game ends — check if all imposters have been voted out
      const livingSpies = this.spies.filter(id => !this.eliminatedPlayers.has(id));
      if (livingSpies.length === 0) {
        this.winner = 'innocents';
        this.winReason = 'no-imposters-declared';
        this.tallyResultText = `✅ All imposters eliminated! Innocents win!`;
      } else {
        this.winner = 'impostors';
        this.winReason = 'no-imposters-wrong-call';
        this.tallyResultText = `🕵️ Wrong call! ${livingSpies.length} Impostor(s) still alive! Impostors win!`;
      }
      // Always reveal all roles when game ends via No Imposters Left
      this.tallyData = Array.from(this.room.players.keys()).map(id => {
        const p = this.room.players.get(id);
        return {
          id,
          name: p ? p.name : 'Player',
          avatar: p ? p.avatar : '😎',
          votesReceived: voteCounts.get(id) || 0,
          isSpy: this.spies.includes(id),
          isEliminated: this.eliminatedPlayers.has(id)
        };
      });
      this.log.push({ type: 'vote', text: `📊 ${this.tallyResultText}` });
      this.startTimer();
      this.emitEvent('game_state_updated');
      return;
    }

    // Elimination Mode Rule: Plurality (default) vs Strict Majority
    const isMajorityMode = this.settings.eliminationMode === 'majority';
    const majorityThreshold = Math.floor(livingPlayers.length / 2) + 1;

    // Find max votes (for player elimination)
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

    const hasEnoughVotes = isMajorityMode ? (maxVotes >= majorityThreshold) : (maxVotes > 0);
    const modeLabel = isMajorityMode ? 'Majority' : 'Plurality';

    if (!isTie && accusedId && hasEnoughVotes) {
      const accusedPlayer = this.room.players.get(accusedId);
      this.eliminatedPlayers.add(accusedId);

      // Check impostor majority AFTER elimination (but never reveal spy status yet)
      const remainingLiving = livingPlayers.filter(id => id !== accusedId);
      const livingSpies = this.spies.filter(id => !this.eliminatedPlayers.has(id));
      const livingInnocents = remainingLiving.length - livingSpies.length;

      if (livingSpies.length >= livingInnocents && livingSpies.length > 0) {
        // Impostors have reached majority — game over, NOW reveal all roles
        this.winner = 'impostors';
        this.winReason = 'impostors-majority';
        this.tallyResultText = `🕵️ ${accusedPlayer ? accusedPlayer.name : 'Someone'} was voted out (${modeLabel})! Impostors have reached majority! Game Over!`;
      } else {
        // NEVER reveal if accused was a spy — just say they were voted out
        this.tallyResultText = `👤 ${accusedPlayer ? accusedPlayer.name : 'Someone'} was voted out (${modeLabel})!`;
      }
    } else if (isMajorityMode && !isTie && accusedId && maxVotes > 0 && maxVotes < majorityThreshold) {
      const accusedPlayer = this.room.players.get(accusedId);
      this.tallyResultText = `⚖️ ${accusedPlayer ? accusedPlayer.name : 'Candidate'} received ${maxVotes} vote${maxVotes === 1 ? '' : 's'}, but strict majority requires ${majorityThreshold}/${livingPlayers.length} votes. No one was eliminated!`;
    } else if (isTie) {
      this.tallyResultText = `⚖️ Voting resulted in a tie (${maxVotes} votes each)! No one was eliminated.`;
    } else {
      this.tallyResultText = '⚖️ No votes were cast. No one was eliminated.';
    }

    // Reveal isSpy in tally only when game has ended
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
    if (this.timerSeconds <= 0) return;
    this.emitEvent('timer_tick', { timerSeconds: this.timerSeconds, phase: this.phase });

    this.timerInterval = setInterval(() => {
      if (this.timerSeconds > 0) {
        this.timerSeconds--;
        this.emitEvent('timer_tick', { timerSeconds: this.timerSeconds, phase: this.phase });
        if (this.timerSeconds === 0) {
          this.onTimerExpired();
        }
      } else {
        this.onTimerExpired();
      }
    }, 1000);
  }

  onTimerExpired() {
    this.stopTimer();
    if (this.phase === 'discussion') {
      if (!this.settings.coverTyping || this.settings.coverTyping === 'false') {
        this.startVotingPhase();
      } else {
        this.startTypingGuessPhase();
      }
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

            // Auto-advance only if ALL living players (innocents & spies) have completed camouflage
            const allLiving = Array.from(room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
            if (allLiving.length > 0 && allLiving.every(id => this.completedCamouflage.has(id))) {
              this.startVotingPhase();
            }
          }
        }
        break;

      case 'submit_vote':
        if (this.phase === 'voting' && !this.eliminatedPlayers.has(socketId)) {
          const livingPlayers = Array.from(room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
          const isSwap = this.votes.has(socketId) && this.votes.get(socketId) !== data.targetId;

          if (data.targetId === 'NO_IMPOSTERS') {
            // Only allow once enough players have been eliminated to make 0 imposters mathematically possible
            const actualSpiesCount = this.spies.length;
            const eligibleForNoImp = this.eliminatedPlayers.size >= actualSpiesCount;
            if (eligibleForNoImp) {
              this.votes.set(socketId, 'NO_IMPOSTERS');
              if (isSwap) {
                this.log.push({ type: 'vote', text: `👤 ${player.name} changed vote to — No Imposters Left!` });
              } else {
                this.log.push({ type: 'vote', text: `👤 ${player.name} voted — No Imposters Left!` });
              }
            }
          } else if (data.targetId && data.targetId !== socketId && !this.eliminatedPlayers.has(data.targetId)) {
            this.votes.set(socketId, data.targetId);
            if (isSwap) {
              this.log.push({ type: 'vote', text: `👤 ${player.name} swapped their vote.` });
            } else {
              this.log.push({ type: 'vote', text: `👤 ${player.name} submitted their vote.` });
            }
          }

          // Do not auto-advance when everyone has voted; only advance on timer expiration or host action
          this.emitEvent('game_state_updated');
        }
        break;

      case 'spy_guess_location':
        this.spyGuessLocation(socketId, data.location);
        break;

      case 'host_start_voting':
      case 'host_advance_phase':
        if (player.isHost) {
          if (this.phase === 'discussion') {
            if (!this.settings.coverTyping || this.settings.coverTyping === 'false') {
              this.startVotingPhase();
            } else {
              this.startTypingGuessPhase();
            }
          } else if (this.phase === 'typing_guess') {
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
        break;

      case 'adjust_timer':
        // Host-only: add seconds or set specific timer
        if (player.isHost && (this.phase === 'discussion' || this.phase === 'voting' || this.phase === 'typing_guess')) {
          if (data.delta) {
            this.timerSeconds = Math.max(0, this.timerSeconds + data.delta);
            this.emitEvent('timer_tick', { timerSeconds: this.timerSeconds, phase: this.phase });
          } else if (data.set !== undefined) {
            this.timerSeconds = Math.max(0, data.set);
            this.emitEvent('timer_tick', { timerSeconds: this.timerSeconds, phase: this.phase });
            if (this.timerSeconds === 0) {
              this.onTimerExpired();
            }
          }
        }
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

      const allLiving = Array.from(this.room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
      if (allLiving.length > 0 && allLiving.every(id => this.completedCamouflage.has(id))) {
        this.startVotingPhase();
      }
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
      this.log.push({ type: 'warning', text: `❌ SPY FAIL! ${spyPlayer ? spyPlayer.name : 'The Impostor'} guessed "${guessedLocation}", which was WRONG! ${spyPlayer ? spyPlayer.name : 'The Impostor'} is ousted!` });

      const livingSpies = this.spies.filter(id => !this.eliminatedPlayers.has(id));
      if (livingSpies.length === 0) {
        this.stopTimer();
        this.winner = 'innocents';
        this.winReason = 'all-spies-eliminated';
        this.phase = 'ended';
      } else {
        const livingPlayers = Array.from(this.room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
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

    if (this.starterPlayerId === oldSocketId) {
      this.starterPlayerId = newSocketId;
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

    const liveVoteTally = {};
    for (const targetId of this.votes.values()) {
      liveVoteTally[targetId] = (liveVoteTally[targetId] || 0) + 1;
    }

    const starterPlayerObj = this.starterPlayerId ? room.players.get(this.starterPlayerId) : null;
    const starterPlayer = starterPlayerObj ? {
      id: starterPlayerObj.id,
      name: starterPlayerObj.name,
      avatar: starterPlayerObj.avatar || '😎'
    } : null;

    return {
      gameId: 'spy',
      category: displayCategory,
      location: displayLocation,
      role: roleInfo.role,
      isSpy,
      isEliminated,
      starterPlayerId: this.starterPlayerId,
      starterPlayer,
      isStarter: this.starterPlayerId === socketId,
      hasVoted: this.votes.has(socketId),
      myVote: this.votes.get(socketId) || null,
      liveVoteTally,
      noImpVoteCount: Array.from(this.votes.values()).filter(v => v === 'NO_IMPOSTERS').length,
      hasGuessed: this.usedSpyGuess.has(socketId),
      camouflageWord: !isSpy ? this.camouflageWords.get(socketId) : null,
      camouflageCompleted: this.completedCamouflage.has(socketId),
      phase: this.phase,
      possibleLocations: this.possibleLocations,
      timerSeconds: this.timerSeconds,
      tallyData: this.phase === 'tally' ? this.tallyData : [],
      tallyResultText: this.tallyResultText,
      livingPlayers,
      votesCount: this.votes.size,
      totalLivingPlayers: livingPlayers.length,
      eliminatedCount: this.eliminatedPlayers.size,
      eliminatedSpiesCount: Array.from(this.eliminatedPlayers).filter(id => {
        const roleInfo = this.playerRoles.get(id);
        return roleInfo && roleInfo.isSpy;
      }).length,
      totalSpiesCount: this.spies.length,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isAlive: !this.eliminatedPlayers.has(p.id)
      })),
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

module.exports = SpyInstance;
