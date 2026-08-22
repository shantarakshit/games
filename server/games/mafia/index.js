const fs = require('fs');
const path = require('path');

class MafiaInstance {
  constructor(room, emitEvent) {
    this.room = room;
    this.emitEvent = emitEvent;

    const mafiaSettings = room.settings.mafia || {};
    this.settings = Object.assign({
      murderersCount: 'auto', // 'auto' | 1 | 2 | 3
      discussionTimer: 120,   // seconds
      votingTimer: 30         // seconds
    }, mafiaSettings);

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

    // 1. Identify Non-Host Players
    const allSockets = Array.from(this.room.players.keys());
    const playerSockets = allSockets.filter(id => id !== this.hostSocketId);

    // 2. Determine Murderers Count
    let numMurderers = 1;
    const countSetting = this.settings.murderersCount;
    if (countSetting === 1 || countSetting === '1') {
      numMurderers = 1;
    } else if (countSetting === 2 || countSetting === '2') {
      numMurderers = Math.min(2, Math.max(1, Math.floor((playerSockets.length - 2) / 2)));
    } else if (countSetting === 3 || countSetting === '3') {
      numMurderers = Math.min(3, Math.max(1, Math.floor((playerSockets.length - 2) / 2)));
    } else {
      // Auto distribution based on group size
      if (playerSockets.length >= 14) {
        numMurderers = 3;
      } else if (playerSockets.length >= 9) {
        numMurderers = 2;
      } else {
        numMurderers = 1;
      }
    }

    // Clamp murderers to ensure game balance
    if (playerSockets.length <= 3) {
      numMurderers = 1;
    } else {
      numMurderers = Math.min(numMurderers, Math.floor((playerSockets.length - 1) / 2));
    }
    if (numMurderers < 1) numMurderers = 1;

    // 3. Shuffle & Distribute Roles
    const shuffled = [...playerSockets].sort(() => Math.random() - 0.5);
    
    // Assign Host
    if (this.hostSocketId && allSockets.includes(this.hostSocketId)) {
      this.roles.set(this.hostSocketId, { role: 'host', isAlive: true });
    }

    // Assign Murderers
    const murdererIds = shuffled.slice(0, numMurderers);
    murdererIds.forEach(id => {
      this.roles.set(id, { role: 'murderer', isAlive: true });
    });

    let cursor = numMurderers;

    // Assign Doctor (if at least 2 non-host players)
    if (cursor < shuffled.length) {
      const doctorId = shuffled[cursor++];
      this.roles.set(doctorId, { role: 'doctor', isAlive: true });
    }

    // Assign Detective (if at least 3 non-host players)
    if (cursor < shuffled.length) {
      const detectiveId = shuffled[cursor++];
      this.roles.set(detectiveId, { role: 'detective', isAlive: true });
    }

    // Assign Civilians to all remaining
    while (cursor < shuffled.length) {
      const civId = shuffled[cursor++];
      this.roles.set(civId, { role: 'civilian', isAlive: true });
    }

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

  /**
   * Helper: Retrieve or initialize round entry in hostActionLedger.
   */
  getHostActionLedgerEntry(round) {
    let entry = this.hostActionLedger.find(e => e.round === round);
    if (!entry) {
      entry = {
        round,
        nightAttacks: [],
        confirmedVictimName: null,
        doctorSave: null,
        detectiveInquiry: null,
        morningOutcome: null,
        dayVotes: [],
        eliminated: null
      };
      this.hostActionLedger.push(entry);
    }
    return entry;
  }

  /**
   * Start Night Phase 1: Murderers Target Selection.
   */
  startNightPhase1() {
    this.stopTimer();
    this.phase = 'night_murderers';
    this.resetRoundState();
    this.getHostActionLedgerEntry(this.round);

    this.log.push({
      type: 'night',
      text: `🌙 Night ${this.round} has fallen! Murderers are selecting a victim.`
    });

    this.emitEvent('game_state_updated');
  }

  /**
   * Start Night Phase 2: Doctor Protection.
   */
  startNightPhase2() {
    this.stopTimer();
    this.phase = 'night_doctor';
    this.currentDoctorSavedId = null;

    const doctorId = this.getSpecialRoleSocketId('doctor');
    const isDoctorAlive = doctorId && !this.eliminatedPlayers.has(doctorId);

    this.log.push({
      type: 'night',
      text: `💉 Doctor is choosing someone to protect.`
    });

    this.emitEvent('game_state_updated');
  }

  /**
   * Start Night Phase 3: Detective Investigation.
   */
  startNightPhase3() {
    this.stopTimer();
    this.phase = 'night_detective';
    this.currentDetectiveInquiry = null;

    const detId = this.getSpecialRoleSocketId('detective');
    const isDetAlive = detId && !this.eliminatedPlayers.has(detId);

    this.log.push({
      type: 'night',
      text: `🔍 Detective is investigating a suspect.`
    });

    this.emitEvent('game_state_updated');
  }

  /**
   * Start Day Phase 4: Morning Revelation & Host Story.
   */
  startDayPhase4() {
    this.stopTimer();
    this.phase = 'day_morning';

    // Resolve Night Actions
    const victimId = this.confirmedMurdererVictimId;
    const savedId = this.currentDoctorSavedId;
    const wasSaved = (victimId && savedId && victimId === savedId);

    this.morningAttackedVictimId = victimId;
    this.morningWasSaved = wasSaved;

    const victimPlayer = victimId ? this.room.players.get(victimId) : null;
    const ledgerEntry = this.getHostActionLedgerEntry(this.round);
    ledgerEntry.morningOutcome = {
      attackedVictimName: victimPlayer ? victimPlayer.name : null,
      wasSaved
    };

    // If victim was targeted and NOT saved, eliminate them now
    if (victimId && !wasSaved) {
      this.eliminatedPlayers.add(victimId);
      const victimInfo = this.roles.get(victimId);
      if (victimInfo) victimInfo.isAlive = false;
      this.log.push({
        type: 'morning_kill',
        text: `🌅 Morning ${this.round}: ${victimPlayer ? victimPlayer.name : 'A townsperson'} was found murdered in the night!`
      });
    } else if (victimId && wasSaved) {
      this.log.push({
        type: 'morning_save',
        text: `🌅 Morning ${this.round}: An attack took place, but the Doctor arrived in time! Nobody died.`
      });
    } else {
      this.log.push({
        type: 'morning_quiet',
        text: `🌅 Morning ${this.round}: The town awoke peacefully. Nobody was attacked.`
      });
    }

    // Record Round Night Action in Timeline
    this.recordNightTimeline();

    // Check Win Condition after morning elimination
    if (this.checkWinConditions()) {
      this.phase = 'ended';
      this.emitEvent('game_state_updated');
      return;
    }

    this.emitEvent('game_state_updated');
  }

  /**
   * Start Day Phase 5: Daytime Discussion.
   */
  startDayPhase5() {
    this.stopTimer();
    this.phase = 'day_discussion';
    this.timerSeconds = parseInt(this.settings.discussionTimer, 10) || 120;

    this.log.push({
      type: 'discussion',
      text: `💬 Town discussion open (${Math.floor(this.timerSeconds / 60)} min). Debate and find the murderers!`
    });

    this.startTimer();
    this.emitEvent('game_state_updated');
  }

  /**
   * Start Day Phase 6: Secret Voting.
   */
  startDayPhase6() {
    this.stopTimer();
    this.phase = 'day_voting';
    this.dayVotes.clear();
    this.timerSeconds = parseInt(this.settings.votingTimer, 10) || 30;

    this.log.push({
      type: 'voting',
      text: `🗳️ ${this.timerSeconds}-second secret voting ballot open. Cast your vote!`
    });

    this.startTimer();
    this.emitEvent('game_state_updated');
  }

  /**
   * Start Day Phase 7: Results Tally & Elimination.
   */
  startDayPhase7() {
    this.stopTimer();
    this.phase = 'day_tally';

    const livingVoters = this.getLivingPlayerIds().filter(id => id !== this.hostSocketId);
    const voteCounts = new Map();
    livingVoters.forEach(id => voteCounts.set(id, 0));
    let abstainCount = 0;

    for (const [voterId, candidateId] of this.dayVotes.entries()) {
      if (livingVoters.includes(voterId)) {
        if (candidateId === 'ABSTAIN') {
          abstainCount++;
        } else if (voteCounts.has(candidateId)) {
          voteCounts.set(candidateId, voteCounts.get(candidateId) + 1);
        }
      }
    }

    // Strict majority rule: votes > floor(livingVoters.length / 2)
    const majorityThreshold = Math.floor(livingVoters.length / 2) + 1;
    let maxVotes = 0;
    let highestCandidateId = null;
    let isTie = false;

    for (const [id, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        highestCandidateId = id;
        isTie = false;
      } else if (count === maxVotes && count > 0) {
        isTie = true;
      }
    }

    let eliminatedId = null;
    let isLastMurderer = false;

    if (!isTie && highestCandidateId && maxVotes >= majorityThreshold) {
      eliminatedId = highestCandidateId;
      this.eliminatedPlayers.add(eliminatedId);
      const playerInfo = this.roles.get(eliminatedId);
      if (playerInfo) playerInfo.isAlive = false;

      const eliminatedPlayer = this.room.players.get(eliminatedId);
      const livingMurderers = this.getLivingMurdererIds();

      if (playerInfo && playerInfo.role === 'murderer' && livingMurderers.length === 0) {
        isLastMurderer = true;
        this.tallyResultText = `⚖️ ${eliminatedPlayer ? eliminatedPlayer.name : 'Player'} received ${maxVotes} votes (Majority). The LAST murderer was eliminated!`;
      } else {
        this.tallyResultText = `⚖️ ${eliminatedPlayer ? eliminatedPlayer.name : 'Player'} received ${maxVotes} votes (Majority) and was eliminated by town vote!`;
      }
    } else {
      this.tallyResultText = `⚖️ No majority reached (${majorityThreshold} votes needed). No one was eliminated this round.`;
    }

    this.eliminatedInTallyId = eliminatedId;

    // Build anonymous tally data array (candidate names & vote count)
    this.tallyData = livingVoters.map(id => {
      const p = this.room.players.get(id);
      return {
        id,
        name: p ? p.name : 'Player',
        avatar: p ? p.avatar : '😎',
        votesReceived: voteCounts.get(id) || 0,
        isEliminated: this.eliminatedPlayers.has(id)
      };
    });

    if (abstainCount > 0) {
      this.tallyData.push({
        id: 'ABSTAIN',
        name: 'Abstained / Skipped',
        avatar: '⚪',
        votesReceived: abstainCount,
        isEliminated: false
      });
    }

    // Record Day Voting in Timeline
    this.recordDayTimeline(majorityThreshold, maxVotes, eliminatedId);

    // Record in Host Action Ledger
    const ledgerEntry = this.getHostActionLedgerEntry(this.round);
    ledgerEntry.dayVotes = [];
    for (const [voterId, candId] of this.dayVotes.entries()) {
      const vPlayer = this.room.players.get(voterId);
      const cPlayer = candId === 'ABSTAIN' ? { name: 'Abstained / Skipped' } : this.room.players.get(candId);
      ledgerEntry.dayVotes.push({
        voterName: vPlayer ? vPlayer.name : 'Player',
        targetName: cPlayer ? cPlayer.name : 'Unknown'
      });
    }
    if (eliminatedId) {
      const elimPlayer = this.room.players.get(eliminatedId);
      const elimRole = this.roles.get(eliminatedId);
      ledgerEntry.eliminated = {
        name: elimPlayer ? elimPlayer.name : 'Player',
        role: elimRole ? elimRole.role : 'civilian'
      };
    }

    this.log.push({
      type: 'tally',
      text: `📊 ${this.tallyResultText}`
    });

    // Check Win Condition
    if (this.checkWinConditions()) {
      this.phase = 'ended';
    }

    // Update Doctor saved history for next round
    this.previousDoctorSavedId = this.currentDoctorSavedId;

    this.emitEvent('game_state_updated');
  }

  /**
   * Record Night action details into timeline ledger.
   */
  recordNightTimeline() {
    let roundRecord = this.timeline.find(t => t.round === this.round);
    if (!roundRecord) {
      roundRecord = { round: this.round };
      this.timeline.push(roundRecord);
    }

    const victimPlayer = this.room.players.get(this.confirmedMurdererVictimId);
    const doctorSavedPlayer = this.room.players.get(this.currentDoctorSavedId);
    const detInquiry = this.currentDetectiveInquiry;
    const detSuspectPlayer = detInquiry ? this.room.players.get(detInquiry.suspectId) : null;

    roundRecord.night = {
      murdererTargetId: this.confirmedMurdererVictimId,
      murdererTargetName: victimPlayer ? victimPlayer.name : 'None',
      doctorSavedId: this.currentDoctorSavedId,
      doctorSavedName: doctorSavedPlayer ? doctorSavedPlayer.name : 'None',
      wasSaved: this.morningWasSaved,
      morningVictimId: this.morningWasSaved ? null : this.confirmedMurdererVictimId,
      morningVictimName: this.morningWasSaved ? null : (victimPlayer ? victimPlayer.name : 'None'),
      detectiveInquiry: detInquiry ? {
        suspectId: detInquiry.suspectId,
        suspectName: detSuspectPlayer ? detSuspectPlayer.name : 'Unknown',
        isMurderer: detInquiry.isMurderer
      } : null
    };
  }

  /**
   * Record Day voting details into timeline ledger.
   */
  recordDayTimeline(threshold, maxVotes, eliminatedId) {
    let roundRecord = this.timeline.find(t => t.round === this.round);
    if (!roundRecord) {
      roundRecord = { round: this.round };
      this.timeline.push(roundRecord);
    }

    const elimPlayer = eliminatedId ? this.room.players.get(eliminatedId) : null;
    const elimRole = eliminatedId && this.roles.get(eliminatedId) ? this.roles.get(eliminatedId).role : null;

    roundRecord.day = {
      majorityThreshold: threshold,
      maxVotes,
      eliminatedId,
      eliminatedName: elimPlayer ? elimPlayer.name : null,
      eliminatedRole: elimRole,
      tallyData: [...this.tallyData]
    };
  }

  /**
   * Check Win Conditions.
   */
  checkWinConditions() {
    const livingMurderers = this.getLivingMurdererIds();
    const livingNonMurderers = this.getLivingPlayerIds().filter(id => {
      if (id === this.hostSocketId) return false;
      const r = this.roles.get(id);
      return r && r.role !== 'murderer';
    });

    if (livingMurderers.length === 0) {
      this.winner = 'civilians';
      this.winReason = 'all-murderers-eliminated';
      this.log.push({
        type: 'gameover',
        text: `🏆 CIVILIANS WIN! All murderers have been eliminated from the town!`
      });
      return true;
    }

    if (livingMurderers.length >= livingNonMurderers.length && livingMurderers.length > 0) {
      this.winner = 'murderers';
      this.winReason = 'murderers-majority';
      this.log.push({
        type: 'gameover',
        text: `🔪 MAFIA WINS! The murderers have equaled or outnumbered the townspeople!`
      });
      return true;
    }

    return false;
  }

  /**
   * Start local second countdown timer.
   */
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

  /**
   * Stop countdown timer.
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Timer Expired Callback.
   */
  onTimerExpired() {
    this.stopTimer();
    if (this.phase === 'day_discussion') {
      this.startDayPhase6(); // Advance to voting
    } else if (this.phase === 'day_voting') {
      this.startDayPhase7(); // Force tally
    }
  }

  /**
   * Handle In-Game Client Actions.
   */
  handleAction(socketId, action, data = {}, room, updateCallback) {
    const player = room.players.get(socketId);
    if (!player) return;

    const roleInfo = this.roles.get(socketId);
    const isHost = socketId === room.hostId || socketId === this.hostSocketId || (player && player.isHost);
    const isAlive = roleInfo ? roleInfo.isAlive && !this.eliminatedPlayers.has(socketId) : false;

    switch (action) {
      // 1. Host Starts Round 1 (from Role Reveal)
      case 'host_start_round_1':
        if (isHost && this.phase === 'role_reveal') {
          this.startNightPhase1();
        }
        break;

      // 2. Murderer Votes / Proposes Target
      case 'murderer_vote':
        if (this.phase === 'night_murderers' && isAlive && roleInfo && roleInfo.role === 'murderer') {
          const targetId = data.targetId;
          const targetRole = this.roles.get(targetId);
          // Target must be a living non-murderer and not the host
          if (targetId && targetId !== room.hostId && targetId !== this.hostSocketId && !this.eliminatedPlayers.has(targetId) && targetRole && targetRole.role !== 'murderer') {
            this.murdererVotes.set(socketId, targetId);
            this.evaluateMurdererConsensus();

            const entry = this.getHostActionLedgerEntry(this.round);
            const mPlayer = room.players.get(socketId);
            const tPlayer = room.players.get(targetId);
            const existing = entry.nightAttacks.find(a => a.murdererId === socketId);
            if (existing) {
              existing.targetName = tPlayer ? tPlayer.name : 'Unknown';
            } else {
              entry.nightAttacks.push({
                murdererId: socketId,
                murdererName: mPlayer ? mPlayer.name : 'Murderer',
                targetName: tPlayer ? tPlayer.name : 'Unknown'
              });
            }
            if (this.confirmedMurdererVictimId) {
              const victimPlayer = room.players.get(this.confirmedMurdererVictimId);
              entry.confirmedVictimName = victimPlayer ? victimPlayer.name : null;
            } else {
              entry.confirmedVictimName = null;
            }
          }
        }
        break;

      // 3. Murderer Swaps Target
      case 'murderer_swap_target':
        if (this.phase === 'night_murderers' && isAlive && roleInfo && roleInfo.role === 'murderer') {
          const targetId = data.targetId;
          const targetRole = this.roles.get(targetId);
          if (targetId && targetId !== room.hostId && targetId !== this.hostSocketId && !this.eliminatedPlayers.has(targetId) && targetRole && targetRole.role !== 'murderer') {
            this.murdererVotes.set(socketId, targetId);
            this.evaluateMurdererConsensus();

            const entry = this.getHostActionLedgerEntry(this.round);
            const mPlayer = room.players.get(socketId);
            const tPlayer = room.players.get(targetId);
            const existing = entry.nightAttacks.find(a => a.murdererId === socketId);
            if (existing) {
              existing.targetName = tPlayer ? tPlayer.name : 'Unknown';
            } else {
              entry.nightAttacks.push({
                murdererId: socketId,
                murdererName: mPlayer ? mPlayer.name : 'Murderer',
                targetName: tPlayer ? tPlayer.name : 'Unknown'
              });
            }
            if (this.confirmedMurdererVictimId) {
              const victimPlayer = room.players.get(this.confirmedMurdererVictimId);
              entry.confirmedVictimName = victimPlayer ? victimPlayer.name : null;
            } else {
              entry.confirmedVictimName = null;
            }
          }
        }
        break;

      // 4. Doctor Saves / Protects Target
      case 'doctor_save':
        if (this.phase === 'night_doctor' && isAlive && roleInfo && roleInfo.role === 'doctor') {
          const targetId = data.targetId;
          // Target must be a living player, not the host, and not saved in the immediately preceding round
          if (
            targetId &&
            targetId !== room.hostId &&
            targetId !== this.hostSocketId &&
            !this.eliminatedPlayers.has(targetId) &&
            targetId !== this.previousDoctorSavedId
          ) {
            this.currentDoctorSavedId = targetId;

            const entry = this.getHostActionLedgerEntry(this.round);
            const docPlayer = room.players.get(socketId);
            const savedPlayer = room.players.get(targetId);
            entry.doctorSave = {
              doctorName: docPlayer ? docPlayer.name : 'Doctor',
              savedName: savedPlayer ? savedPlayer.name : 'Unknown'
            };
          }
        }
        break;

      // 5. Detective Investigates Target
      case 'detective_investigate':
        if (this.phase === 'night_detective' && isAlive && roleInfo && roleInfo.role === 'detective') {
          // Exactly 1 investigation per round allowed
          if (this.currentDetectiveInquiry) break;

          const targetId = data.targetId;
          const hist = this.detectiveHistory.get(socketId) || [];
          const alreadyInvestigated = hist.some(h => h.suspectId === targetId);

          // Cannot investigate themselves, the host, dead players, or anyone already investigated
          if (
            targetId &&
            targetId !== socketId &&
            targetId !== room.hostId &&
            targetId !== this.hostSocketId &&
            !this.eliminatedPlayers.has(targetId) &&
            !alreadyInvestigated
          ) {
            const targetRole = this.roles.get(targetId);
            const isMurderer = targetRole ? targetRole.role === 'murderer' : false;
            this.currentDetectiveInquiry = { suspectId: targetId, isMurderer };

            const targetPlayer = room.players.get(targetId);
            hist.push({
              round: this.round,
              suspectId: targetId,
              suspectName: targetPlayer ? targetPlayer.name : 'Player',
              isMurderer
            });
            this.detectiveHistory.set(socketId, hist);

            const entry = this.getHostActionLedgerEntry(this.round);
            const detPlayer = room.players.get(socketId);
            const susPlayer = room.players.get(targetId);
            entry.detectiveInquiry = {
              detectiveName: detPlayer ? detPlayer.name : 'Detective',
              suspectName: susPlayer ? susPlayer.name : 'Unknown',
              isMurderer
            };
          }
        }
        break;

      // 6. Host Advances Phase (Pacing Controller)
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
            // Next round
            if (!this.winner) {
              this.round++;
              this.startNightPhase1();
            }
          }
        }
        break;

      // 7. Daytime Voting Ballot Submission
      case 'submit_day_vote':
        if (this.phase === 'day_voting' && isAlive && socketId !== room.hostId && socketId !== this.hostSocketId) {
          const targetId = data.targetId;
          if (
            targetId === 'ABSTAIN' ||
            (targetId &&
              targetId !== socketId && // A voter cannot vote for themselves
              !this.eliminatedPlayers.has(targetId) &&
              targetId !== this.hostSocketId &&
              targetId !== room.hostId)
          ) {
            this.dayVotes.set(socketId, targetId);
          }
          // End voting automatically if all living voters have cast their ballot
          const livingVoters = this.getLivingPlayerIds().filter(id => id !== this.hostSocketId);
          if (this.dayVotes.size >= livingVoters.length) {
            this.startDayPhase7();
          }
        }
        break;

      // 8. Host Adjusts Timer (+30s or skip to 1s)
      case 'adjust_timer':
        if (isHost && (this.phase === 'day_discussion' || this.phase === 'day_voting')) {
          if (data.delta) {
            this.timerSeconds = Math.max(1, this.timerSeconds + data.delta);
          } else if (data.set !== undefined) {
            this.timerSeconds = Math.max(1, data.set);
          }
          this.emitEvent('timer_tick', { timerSeconds: this.timerSeconds, phase: this.phase });
        }
        break;

      // 9. Host Ends Voting Immediately
      case 'host_end_voting':
        if (isHost && this.phase === 'day_voting') {
          this.startDayPhase7();
        }
        break;

      // 10. Host Restarts Match with New Roles
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

  /**
   * Helper to check if all living murderers agree on 1 victim.
   */
  evaluateMurdererConsensus() {
    const livingMurderers = this.getLivingMurdererIds();
    if (livingMurderers.length === 0) return;

    const votes = [];
    for (const mId of livingMurderers) {
      if (this.murdererVotes.has(mId)) {
        votes.push(this.murdererVotes.get(mId));
      }
    }

    if (votes.length === livingMurderers.length) {
      const firstTarget = votes[0];
      const allAgree = votes.every(t => t === firstTarget);
      if (allAgree) {
        this.confirmedMurdererVictimId = firstTarget;
      } else {
        this.confirmedMurdererVictimId = null;
      }
    } else {
      this.confirmedMurdererVictimId = null;
    }
  }

  /**
   * Helper: Get array of living player socket IDs.
   */
  getLivingPlayerIds() {
    return Array.from(this.room.players.keys()).filter(id => !this.eliminatedPlayers.has(id));
  }

  /**
   * Helper: Get array of living murderer socket IDs.
   */
  getLivingMurdererIds() {
    const living = this.getLivingPlayerIds();
    return living.filter(id => {
      const r = this.roles.get(id);
      return r && r.role === 'murderer';
    });
  }

  /**
   * Helper: Find socketId of a specific unique role ('doctor'|'detective').
   */
  getSpecialRoleSocketId(roleName) {
    for (const [id, r] of this.roles.entries()) {
      if (r.role === roleName) return id;
    }
    return null;
  }

  /**
   * Handle Player Reconnection.
   */
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

  /**
   * Build Sanitized Player State DTO per socket recipient.
   */
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

class MafiaPlugin {
  constructor() {
    this.id = 'mafia';
    this.name = 'Mafia';
    this.description = 'A classic party game of deception, investigation, and survival for 6-18 players!';
    this.icon = '🔪';
    this.minPlayers = 6;
    this.maxPlayers = 18;
    this.category = 'Social Deduction';
    this.settingsSchema = [
      {
        id: 'murderersCount',
        label: 'Number of Murderers',
        type: 'select',
        options: [
          { value: 'auto', label: 'Auto Balanced (1-3 based on group size)' },
          { value: 1, label: '1 Murderer' },
          { value: 2, label: '2 Murderers' },
          { value: 3, label: '3 Murderers' }
        ],
        default: 'auto',
        description: 'Auto mode allocates 1 murderer for <=8 players, 2 for 9-13 players, 3 for 14+ players.'
      },
      {
        id: 'discussionTimer',
        label: 'Daytime Discussion Timer',
        type: 'select',
        options: [
          { value: 60, label: '1 Minute (Speed)' },
          { value: 120, label: '2 Minutes (Standard)' },
          { value: 180, label: '3 Minutes (Casual)' },
          { value: 300, label: '5 Minutes (Extended)' }
        ],
        default: 120,
        description: 'Time allocated for living players to debate in person before town voting.'
      },
      {
        id: 'votingTimer',
        label: 'Town Voting Timer',
        type: 'select',
        options: [
          { value: 20, label: '20 Seconds (Fast)' },
          { value: 30, label: '30 Seconds (Standard)' },
          { value: 60, label: '60 Seconds (Deliberate)' }
        ],
        default: 30,
        description: 'Time allocated for players to secretly cast their elimination ballot.'
      }
    ];
  }

  createInstance(room, emitEvent) {
    return new MafiaInstance(room, emitEvent);
  }
}

module.exports = MafiaPlugin;
