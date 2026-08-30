const RoleManager = require('./RoleManager');
const ActionLedger = require('./ActionLedger');
const NightPhaseHandler = require('./NightPhaseHandler');
const DayPhaseHandler = require('./DayPhaseHandler');

/**
 * MafiaInstance
 * Master game instance orchestrating rounds, phases, player roles, and state projections for Mafia.
 */
class MafiaInstance {
  constructor(room, emitEvent) {
    this.room = room;
    this.emitEvent = emitEvent;

    const mafiaSettings = room.settings.mafia || {};
    const rawDiscTimer = mafiaSettings.discussionTimer !== undefined ? Number(mafiaSettings.discussionTimer) : 180;
    const rawVoteTimer = mafiaSettings.votingTimer !== undefined ? Number(mafiaSettings.votingTimer) : 30;

    this.settings = Object.assign({
      murderersCount: 'auto', // 'auto' | 1 | 2 | 3
      discussionTimer: isNaN(rawDiscTimer) ? 180 : rawDiscTimer,   // seconds (0 = No Timer)
      votingTimer: isNaN(rawVoteTimer) ? 30 : rawVoteTimer,        // seconds (0 = No Timer)
      eliminationMode: 'plurality'                                 // 'plurality' | 'majority'
    }, mafiaSettings);
    this.settings.discussionTimer = isNaN(rawDiscTimer) ? 180 : rawDiscTimer;
    this.settings.votingTimer = isNaN(rawVoteTimer) ? 30 : rawVoteTimer;
    this.settings.eliminationMode = mafiaSettings.eliminationMode || 'plurality';

    // Core Game State
    this.round = 1;
    this.phase = 'role_reveal'; // 'role_reveal' | 'night_murderers' | 'night_doctor' | 'night_detective' | 'day_morning' | 'day_discussion' | 'day_voting' | 'day_tally' | 'ended'
    
    // Roles & Players
    this.hostSocketId = room.hostId;
    this.roles = new Map(); // socketId -> { role: 'host'|'murderer'|'doctor'|'detective'|'civilian', isAlive: true }
    this.eliminatedPlayers = new Set(); // Set of socketIds who are dead
    
    // Night Actions for Current Round
    this.murdererVotes = new Map(); // murdererSocketId -> targetSocketId
    this.confirmedMurdererVictimId = null; // target agreed upon by murderers
    this.previousDoctorSavedId = null; // socketId of player saved in previous round
    this.currentDoctorSavedId = null;  // socketId of player saved in current round
    this.currentDetectiveInquiry = null; // { suspectId: string, isMurderer: boolean }
    this.detectiveHistory = new Map(); // detectiveSocketId -> Array of { round, suspectId, suspectName, isMurderer }

    // Morning Resolution for Current Round
    this.morningAttackedVictimId = null;
    this.morningWasSaved = false;

    // Day Voting for Current Round
    this.dayVotes = new Map(); // voterSocketId -> candidateSocketId | 'ABSTAIN'
    this.tallyData = [];
    this.tallyResultText = '';
    this.eliminatedInTallyId = null;

    // Timer & Win States
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.winner = null; // 'civilians' | 'murderers'
    this.winReason = null;

    // Match Timeline & Log
    this.timeline = []; // Array of round summary objects
    this.log = [];
    this.hostActionLedger = []; // Detailed round-by-round secret action ledger for Host

    this.setupNewGame();
  }

  /**
   * Initialize or restart Mafia game with fresh randomized roles.
   */
  setupNewGame() {
    this.stopTimer();

    this.round = 1;
    this.phase = 'role_reveal';
    this.hostSocketId = this.room.hostId;
    this.eliminatedPlayers.clear();
    this.roles.clear();
    this.detectiveHistory.clear();
    this.timeline = [];
    this.hostActionLedger = [];
    this.winner = null;
    this.winReason = null;
    this.previousDoctorSavedId = null;

    this.resetRoundState();

    // Distribute roles secretly
    this.roles = RoleManager.distributeRoles(this.room, this.settings, this.hostSocketId);

    this.log = [{
      type: 'system',
      text: `🎭 Mafia match initialized! Round 1. Roles have been assigned secretly.`
    }];

    this.emitEvent('game_state_updated');
  }

  /**
   * Reset round-specific transient night and day state.
   */
  resetRoundState() {
    this.murdererVotes.clear();
    this.confirmedMurdererVictimId = null;
    this.currentDoctorSavedId = null;
    this.currentDetectiveInquiry = null;
    this.morningAttackedVictimId = null;
    this.morningWasSaved = false;
    this.dayVotes.clear();
    this.tallyData = [];
    this.tallyResultText = '';
    this.eliminatedInTallyId = null;
  }

  getHostActionLedgerEntry(round) {
    return ActionLedger.getEntry(this.hostActionLedger, round);
  }

  recordNightTimeline() {
    ActionLedger.recordNightTimeline(this);
  }

  recordDayTimeline(maxVotes, isTie, eliminatedId) {
    ActionLedger.recordDayTimeline(this, maxVotes, isTie, eliminatedId);
  }

  startNightPhase1() {
    NightPhaseHandler.startPhase1(this);
  }

  startNightPhase2() {
    NightPhaseHandler.startPhase2(this);
  }

  startNightPhase3() {
    NightPhaseHandler.startPhase3(this);
  }

  startDayPhase4() {
    DayPhaseHandler.startPhase4(this);
  }

  startDayPhase5() {
    DayPhaseHandler.startPhase5(this);
  }

  startDayPhase6() {
    DayPhaseHandler.startPhase6(this);
  }

  startDayPhase7() {
    DayPhaseHandler.startPhase7(this);
  }

  checkWinConditions() {
    return DayPhaseHandler.checkWinConditions(this);
  }

  evaluateMurdererConsensus() {
    NightPhaseHandler.evaluateMurdererConsensus(this);
  }

  getLivingPlayerIds() {
    return Array.from(this.room.players.keys()).filter(id => id !== this.hostSocketId && !this.eliminatedPlayers.has(id));
  }

  getLivingMurdererIds() {
    const living = this.getLivingPlayerIds();
    return living.filter(id => {
      const r = this.roles.get(id);
      return r && r.role === 'murderer';
    });
  }

  getSpecialRoleSocketId(roleName) {
    for (const [id, r] of this.roles.entries()) {
      if (r.role === roleName) return id;
    }
    return null;
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

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  onTimerExpired() {
    this.stopTimer();
    if (this.phase === 'day_discussion') {
      this.startDayPhase6(); // Advance to voting
    } else if (this.phase === 'day_voting') {
      this.startDayPhase7(); // Force tally
    }
  }

  handleAction(socketId, action, data = {}, room, updateCallback) {
    const player = room.players.get(socketId);
    if (!player) return;

    if (room.hostId) {
      this.hostSocketId = room.hostId;
    }

    const roleInfo = this.roles.get(socketId);
    const isHost = socketId === room.hostId || socketId === this.hostSocketId || (player && player.isHost);
    const isAlive = roleInfo ? roleInfo.isAlive && !this.eliminatedPlayers.has(socketId) : false;

    switch (action) {
      case 'host_start_round_1':
        if (isHost && this.phase === 'role_reveal') {
          this.startNightPhase1();
        }
        break;

      case 'murderer_vote':
      case 'murderer_swap_target':
        NightPhaseHandler.handleMurdererVote(this, socketId, data.targetId, room);
        break;

      case 'doctor_save':
        NightPhaseHandler.handleDoctorSave(this, socketId, data.targetId, room);
        break;

      case 'detective_investigate':
        NightPhaseHandler.handleDetectiveInvestigate(this, socketId, data.targetId, room);
        break;

      case 'host_advance_phase':
        if (isHost) {
          if (this.phase === 'role_reveal') {
            this.startNightPhase1();
          } else if (this.phase === 'night_murderers') {
            this.startNightPhase2();
          } else if (this.phase === 'night_doctor') {
            this.startNightPhase3();
          } else if (this.phase === 'night_detective') {
            this.startDayPhase4();
          } else if (this.phase === 'day_morning') {
            this.startDayPhase5();
          } else if (this.phase === 'day_discussion') {
            this.startDayPhase6();
          } else if (this.phase === 'day_voting') {
            this.startDayPhase7();
          } else if (this.phase === 'day_tally') {
            if (!this.winner) {
              this.round++;
              this.startNightPhase1();
            }
          }
        }
        break;

      case 'submit_day_vote':
        if (this.phase === 'day_voting' && isAlive && socketId !== room.hostId && socketId !== this.hostSocketId) {
          const targetId = data.targetId;
          if (
            targetId === 'ABSTAIN' ||
            (targetId &&
              targetId !== socketId &&
              !this.eliminatedPlayers.has(targetId) &&
              targetId !== this.hostSocketId &&
              targetId !== room.hostId)
          ) {
            this.dayVotes.set(socketId, targetId);
          }
          // Do not auto-advance when all players have voted; only advance when timer runs out or host advances
        }
        break;

      case 'adjust_timer':
        if (isHost && (this.phase === 'day_discussion' || this.phase === 'day_voting')) {
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

      case 'host_end_voting':
        if (isHost && this.phase === 'day_voting') {
          this.startDayPhase7();
        }
        break;

      case 'restart_game':
        if (isHost) {
          this.setupNewGame();
        }
        break;
    }

    if (updateCallback) {
      updateCallback();
    } else {
      this.emitEvent('game_state_updated');
    }
  }

  reconnectPlayer(oldSocketId, newSocketId) {
    if (this.hostSocketId === oldSocketId) {
      this.hostSocketId = newSocketId;
    }

    if (this.roles.has(oldSocketId)) {
      const roleData = this.roles.get(oldSocketId);
      this.roles.delete(oldSocketId);
      this.roles.set(newSocketId, roleData);
    }

    if (this.eliminatedPlayers.has(oldSocketId)) {
      this.eliminatedPlayers.delete(oldSocketId);
      this.eliminatedPlayers.add(newSocketId);
    }

    if (this.murdererVotes.has(oldSocketId)) {
      const target = this.murdererVotes.get(oldSocketId);
      this.murdererVotes.delete(oldSocketId);
      this.murdererVotes.set(newSocketId, target);
    }

    if (this.previousDoctorSavedId === oldSocketId) {
      this.previousDoctorSavedId = newSocketId;
    }

    if (this.currentDoctorSavedId === oldSocketId) {
      this.currentDoctorSavedId = newSocketId;
    }

    if (this.confirmedMurdererVictimId === oldSocketId) {
      this.confirmedMurdererVictimId = newSocketId;
    }

    if (this.detectiveHistory.has(oldSocketId)) {
      const hist = this.detectiveHistory.get(oldSocketId);
      this.detectiveHistory.delete(oldSocketId);
      this.detectiveHistory.set(newSocketId, hist);
    }

    if (this.dayVotes.has(oldSocketId)) {
      const target = this.dayVotes.get(oldSocketId);
      this.dayVotes.delete(oldSocketId);
      this.dayVotes.set(newSocketId, target);
    }
  }

  getPlayerState(socketId, player, room) {
    const isHost = socketId === room.hostId || socketId === this.hostSocketId || player.isHost;
    const roleInfo = this.roles.get(socketId) || { role: 'civilian', isAlive: true };
    const myRole = isHost ? 'host' : roleInfo.role;
    const isEliminated = this.eliminatedPlayers.has(socketId);

    // List of living non-host players
    const livingPlayers = Array.from(room.players.keys())
      .filter(id => id !== room.hostId && id !== this.hostSocketId && !this.eliminatedPlayers.has(id))
      .map(id => {
        const p = room.players.get(id);
        return {
          id,
          name: p ? p.name : 'Player',
          avatar: p ? p.avatar : '😎',
          isMe: id === socketId
        };
      });

    // List of all players with status
    const allPlayersList = Array.from(room.players.values()).map(p => {
      const r = this.roles.get(p.id);
      const isAlive = !this.eliminatedPlayers.has(p.id);
      const playerIsHost = p.id === room.hostId || p.id === this.hostSocketId || p.isHost;
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isHost: playerIsHost,
        isAlive,
        // Role is visible to Host, to oneself, and to everyone when game is ended
        revealedRole: (isHost || this.winner || p.id === socketId || (myRole === 'murderer' && r?.role === 'murderer'))
          ? (playerIsHost ? 'Host 👑' : r?.role || 'civilian')
          : undefined
      };
    });

    // Multi-murderer voting & swapping payload
    let murdererData = null;
    if (myRole === 'murderer' || isHost) {
      const livingMurderers = this.getLivingMurdererIds();
      const murderVotesList = [];
      const distinctTargets = new Map(); // targetId -> Array of voterNames

      for (const mId of livingMurderers) {
        const mPlayer = room.players.get(mId);
        const targetId = this.murdererVotes.get(mId) || null;
        const targetPlayer = targetId ? room.players.get(targetId) : null;
        
        murderVotesList.push({
          murdererId: mId,
          murdererName: mPlayer ? mPlayer.name : 'Murderer',
          murdererAvatar: mPlayer ? mPlayer.avatar : '🔪',
          targetId,
          targetName: targetPlayer ? targetPlayer.name : null,
          targetAvatar: targetPlayer ? targetPlayer.avatar : null
        });

        if (targetId && targetPlayer) {
          if (!distinctTargets.has(targetId)) {
            distinctTargets.set(targetId, {
              targetId,
              targetName: targetPlayer.name,
              targetAvatar: targetPlayer.avatar,
              voters: []
            });
          }
          distinctTargets.get(targetId).voters.push(mPlayer ? mPlayer.name : 'Murderer');
        }
      }

      murdererData = {
        livingMurderersCount: livingMurderers.length,
        myVote: this.murdererVotes.get(socketId) || null,
        votesList: murderVotesList,
        distinctTargets: Array.from(distinctTargets.values()),
        confirmedVictimId: this.confirmedMurdererVictimId,
        confirmedVictimName: this.confirmedMurdererVictimId ? (room.players.get(this.confirmedMurdererVictimId)?.name || 'Victim') : null,
        hasConsensus: !!this.confirmedMurdererVictimId
      };
    }

    // Doctor payload
    let doctorData = null;
    if (myRole === 'doctor' || isHost) {
      doctorData = {
        previousSavedId: this.previousDoctorSavedId,
        previousSavedName: this.previousDoctorSavedId ? (room.players.get(this.previousDoctorSavedId)?.name || 'Protected') : null,
        currentSavedId: this.currentDoctorSavedId,
        currentSavedName: this.currentDoctorSavedId ? (room.players.get(this.currentDoctorSavedId)?.name || 'Protected') : null
      };
    }

    // Detective payload
    let detectiveData = null;
    if (myRole === 'detective' || isHost) {
      detectiveData = {
        currentInquiry: this.currentDetectiveInquiry ? {
          suspectId: this.currentDetectiveInquiry.suspectId,
          suspectName: room.players.get(this.currentDetectiveInquiry.suspectId)?.name || 'Suspect',
          isMurderer: this.currentDetectiveInquiry.isMurderer
        } : null,
        history: this.detectiveHistory.get(socketId) || []
      };
    }

    // Daytime voting progress
    const livingVotersCount = livingPlayers.length;
    const votesCastCount = this.dayVotes.size;

    // Live anonymous voting tally during day_voting phase
    let liveVotingTally = null;
    if (this.phase === 'day_voting') {
      const counts = {};
      livingPlayers.forEach(p => { counts[p.id] = 0; });
      let abstainCount = 0;
      for (const [voterId, candId] of this.dayVotes.entries()) {
        if (candId === 'ABSTAIN') {
          abstainCount++;
        } else if (counts[candId] !== undefined) {
          counts[candId]++;
        }
      }
      liveVotingTally = {
        counts,
        abstainCount,
        votesCastCount,
        livingVotersCount
      };
    }

    const isDoctorAlive = (() => {
      const docId = this.getSpecialRoleSocketId('doctor');
      return docId ? !this.eliminatedPlayers.has(docId) : false;
    })();

    const isDetectiveAlive = (() => {
      const detId = this.getSpecialRoleSocketId('detective');
      return detId ? !this.eliminatedPlayers.has(detId) : false;
    })();

    return {
      gameId: 'mafia',
      round: this.round,
      phase: this.phase,
      myRole,
      isHost,
      isEliminated,
      timerSeconds: this.timerSeconds,
      
      // Players Lists
      livingPlayers,
      allPlayers: allPlayersList,
      
      // Phase Specific Data
      murdererData,
      doctorData,
      detectiveData,

      // Host Only God-Mode Data
      hostActionLedger: isHost ? this.hostActionLedger : undefined,
      isDoctorAlive: isHost ? isDoctorAlive : undefined,
      isDetectiveAlive: isHost ? isDetectiveAlive : undefined,

      // Morning Announcement
      morningAnnouncement: {
        attackedVictimId: this.morningAttackedVictimId,
        attackedVictimName: this.morningAttackedVictimId ? (room.players.get(this.morningAttackedVictimId)?.name || 'A townsperson') : null,
        wasSaved: this.morningWasSaved
      },

      // Daytime Voting & Tally
      hasVotedDay: this.dayVotes.has(socketId),
      myDayVote: this.dayVotes.get(socketId) || null,
      votesCastCount,
      livingVotersCount,
      liveVotingTally,
      tallyData: this.phase === 'day_tally' || this.winner ? this.tallyData : [],
      tallyResultText: this.tallyResultText,
      eliminatedInTallyId: this.eliminatedInTallyId,

      // Game Over & Full Match Timeline
      winner: this.winner,
      winReason: this.winReason,
      timeline: this.timeline,
      log: this.log,
      settings: this.settings,

      myPlayer: {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        isHost
      }
    };
  }

  destroy() {
    this.stopTimer();
  }
}

module.exports = MafiaInstance;
