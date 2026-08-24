const ActionLedger = require('./ActionLedger');

/**
 * DayPhaseHandler
 * Handles morning story resolutions, daytime discussion, secret voting ballots, and tally eliminations.
 */
class DayPhaseHandler {
  /**
   * Start Day Phase 4: Morning Revelation & Host Story.
   */
  static startPhase4(instance) {
    instance.stopTimer();
    instance.phase = 'day_morning';

    // Resolve Night Actions
    const victimId = instance.confirmedMurdererVictimId;
    const savedId = instance.currentDoctorSavedId;
    const wasSaved = Boolean(victimId && savedId && victimId === savedId);

    instance.morningAttackedVictimId = victimId;
    instance.morningWasSaved = wasSaved;

    const victimPlayer = victimId ? instance.room.players.get(victimId) : null;
    const ledgerEntry = ActionLedger.getEntry(instance.hostActionLedger, instance.round);
    ledgerEntry.morningOutcome = {
      attackedVictimName: victimPlayer ? victimPlayer.name : null,
      wasSaved
    };

    // If victim was targeted and NOT saved, eliminate them now
    if (victimId && !wasSaved) {
      instance.eliminatedPlayers.add(victimId);
      const victimInfo = instance.roles.get(victimId);
      if (victimInfo) victimInfo.isAlive = false;
      instance.log.push({
        type: 'morning_kill',
        text: `🌅 Morning ${instance.round}: ${victimPlayer ? victimPlayer.name : 'A townsperson'} was found murdered in the night!`
      });
    } else if (victimId && wasSaved) {
      instance.log.push({
        type: 'morning_save',
        text: `🌅 Morning ${instance.round}: An attack took place, but the Doctor arrived in time! Nobody died.`
      });
    } else {
      instance.log.push({
        type: 'morning_quiet',
        text: `🌅 Morning ${instance.round}: The town awoke peacefully. Nobody was attacked.`
      });
    }

    // Record Round Night Action in Timeline
    instance.recordNightTimeline();

    // Check Win Condition after morning elimination
    if (this.checkWinConditions(instance)) {
      instance.phase = 'ended';
      instance.emitEvent('game_state_updated');
      return;
    }

    instance.emitEvent('game_state_updated');
  }

  /**
   * Start Day Phase 5: Daytime Discussion.
   */
  static startPhase5(instance) {
    instance.stopTimer();
    instance.phase = 'day_discussion';
    const discDuration = (instance.settings.discussionTimer !== undefined && instance.settings.discussionTimer !== null)
      ? Number(instance.settings.discussionTimer)
      : 180;
    instance.timerSeconds = isNaN(discDuration) ? 180 : discDuration;

    if (instance.timerSeconds > 0) {
      instance.log.push({
        type: 'discussion',
        text: `💬 Town discussion open (${Math.floor(instance.timerSeconds / 60)} min). Debate and find the murderers!`
      });
      instance.startTimer();
    } else {
      instance.timerSeconds = 0;
      instance.log.push({
        type: 'discussion',
        text: `💬 Town discussion open (No Timer). Debate and find the murderers!`
      });
    }

    instance.emitEvent('game_state_updated');
  }

  /**
   * Start Day Phase 6: Secret Voting.
   */
  static startPhase6(instance) {
    instance.stopTimer();
    instance.phase = 'day_voting';
    instance.dayVotes.clear();
    const voteDuration = (instance.settings.votingTimer !== undefined && instance.settings.votingTimer !== null)
      ? Number(instance.settings.votingTimer)
      : 30;
    instance.timerSeconds = isNaN(voteDuration) ? 30 : voteDuration;

    if (instance.timerSeconds > 0) {
      instance.log.push({
        type: 'voting',
        text: `🗳️ ${instance.timerSeconds}-second secret voting ballot open. Cast your vote!`
      });
      instance.startTimer();
    } else {
      instance.timerSeconds = 0;
      instance.log.push({
        type: 'voting',
        text: `🗳️ Secret voting ballot open (No Timer). Cast your vote!`
      });
    }

    instance.emitEvent('game_state_updated');
  }

  /**
   * Start Day Phase 7: Results Tally & Elimination.
   */
  static startPhase7(instance) {
    instance.stopTimer();
    instance.phase = 'day_tally';

    const livingVoters = instance.getLivingPlayerIds().filter(id => id !== instance.hostSocketId);
    const voteCounts = new Map();
    livingVoters.forEach(id => voteCounts.set(id, 0));
    let abstainCount = 0;

    for (const [voterId, candidateId] of instance.dayVotes.entries()) {
      if (livingVoters.includes(voterId)) {
        if (candidateId === 'ABSTAIN') {
          abstainCount++;
        } else if (voteCounts.has(candidateId)) {
          voteCounts.set(candidateId, voteCounts.get(candidateId) + 1);
        }
      }
    }

    // Elimination Mode Rule: Plurality (default) vs Strict Majority
    const isMajorityMode = instance.settings.eliminationMode === 'majority';
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
    const hasEnoughVotes = isMajorityMode ? (maxVotes >= majorityThreshold) : (maxVotes > 0);
    const modeLabel = isMajorityMode ? 'Majority' : 'Plurality';

    if (!isTie && highestCandidateId && hasEnoughVotes) {
      eliminatedId = highestCandidateId;
      instance.eliminatedPlayers.add(eliminatedId);
      const playerInfo = instance.roles.get(eliminatedId);
      if (playerInfo) playerInfo.isAlive = false;

      const eliminatedPlayer = instance.room.players.get(eliminatedId);
      const livingMurderers = instance.getLivingMurdererIds();

      if (playerInfo && playerInfo.role === 'murderer' && livingMurderers.length === 0) {
        instance.tallyResultText = `⚖️ ${eliminatedPlayer ? eliminatedPlayer.name : 'Player'} received ${maxVotes} vote${maxVotes === 1 ? '' : 's'} (${modeLabel}). The LAST murderer was eliminated!`;
      } else {
        instance.tallyResultText = `⚖️ ${eliminatedPlayer ? eliminatedPlayer.name : 'Player'} received ${maxVotes} vote${maxVotes === 1 ? '' : 's'} (${modeLabel}) and was eliminated by town vote!`;
      }
    } else if (isMajorityMode && !isTie && highestCandidateId && maxVotes > 0 && maxVotes < majorityThreshold) {
      const highestPlayer = instance.room.players.get(highestCandidateId);
      instance.tallyResultText = `⚖️ ${highestPlayer ? highestPlayer.name : 'Candidate'} received ${maxVotes} vote${maxVotes === 1 ? '' : 's'}, but strict majority requires ${majorityThreshold}/${livingVoters.length} votes. No one was eliminated!`;
    } else if (isTie) {
      instance.tallyResultText = `⚖️ Voting resulted in a tie (${maxVotes} votes each)! No one was eliminated this round.`;
    } else {
      instance.tallyResultText = `⚖️ No votes were cast. No one was eliminated this round.`;
    }

    instance.eliminatedInTallyId = eliminatedId;

    // Build anonymous tally data array
    instance.tallyData = livingVoters.map(id => {
      const p = instance.room.players.get(id);
      return {
        id,
        name: p ? p.name : 'Player',
        avatar: p ? p.avatar : '😎',
        votesReceived: voteCounts.get(id) || 0,
        isEliminated: instance.eliminatedPlayers.has(id)
      };
    });

    if (abstainCount > 0) {
      instance.tallyData.push({
        id: 'ABSTAIN',
        name: 'Abstained / Skipped',
        avatar: '⚪',
        votesReceived: abstainCount,
        isEliminated: false
      });
    }

    // Record Day Voting in Timeline
    instance.recordDayTimeline(maxVotes, isTie, eliminatedId);

    // Record in Host Action Ledger
    const ledgerEntry = ActionLedger.getEntry(instance.hostActionLedger, instance.round);
    ledgerEntry.dayVotes = [];
    for (const [voterId, candId] of instance.dayVotes.entries()) {
      const vPlayer = instance.room.players.get(voterId);
      const cPlayer = candId === 'ABSTAIN' ? { name: 'Abstained / Skipped' } : instance.room.players.get(candId);
      ledgerEntry.dayVotes.push({
        voterName: vPlayer ? vPlayer.name : 'Player',
        targetName: cPlayer ? cPlayer.name : 'Unknown'
      });
    }
    if (eliminatedId) {
      const elimPlayer = instance.room.players.get(eliminatedId);
      const elimRole = instance.roles.get(eliminatedId);
      ledgerEntry.eliminated = {
        name: elimPlayer ? elimPlayer.name : 'Player',
        role: elimRole ? elimRole.role : 'civilian'
      };
    }

    instance.log.push({
      type: 'tally',
      text: `📊 ${instance.tallyResultText}`
    });

    // Check Win Condition
    if (this.checkWinConditions(instance)) {
      instance.phase = 'ended';
    }

    // Update Doctor saved history for next round
    instance.previousDoctorSavedId = instance.currentDoctorSavedId;

    instance.emitEvent('game_state_updated');
  }

  /**
   * Check Win Conditions
   */
  static checkWinConditions(instance) {
    const livingMurderers = instance.getLivingMurdererIds();
    const livingNonMurderers = instance.getLivingPlayerIds().filter(id => {
      if (id === instance.hostSocketId) return false;
      const r = instance.roles.get(id);
      return r && r.role !== 'murderer';
    });

    if (livingMurderers.length === 0) {
      instance.winner = 'civilians';
      instance.winReason = 'all-murderers-eliminated';
      instance.log.push({
        type: 'gameover',
        text: `🏆 CIVILIANS WIN! All murderers have been eliminated from the town!`
      });
      return true;
    }

    if (livingMurderers.length >= livingNonMurderers.length && livingMurderers.length > 0) {
      instance.winner = 'murderers';
      instance.winReason = 'murderers-majority';
      instance.log.push({
        type: 'gameover',
        text: `🔪 MAFIA WINS! The murderers have equaled or outnumbered the townspeople!`
      });
      return true;
    }

    return false;
  }
}

module.exports = DayPhaseHandler;
