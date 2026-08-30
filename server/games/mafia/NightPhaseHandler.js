const ActionLedger = require('./ActionLedger');

/**
 * NightPhaseHandler
 * Handles unified night phase lifecycle: Murderers target selection & consensus, Doctor protection,
 * Detective inquiry, and Civilian favorite player selections concurrently.
 */
class NightPhaseHandler {
  /**
   * Start Unified Night Phase: All active roles make their selections concurrently.
   */
  static startNightPhase(instance) {
    instance.stopTimer();
    instance.phase = 'night';
    instance.resetRoundState();
    ActionLedger.getEntry(instance.hostActionLedger, instance.round);

    instance.log.push({
      type: 'night',
      text: `🌙 Night ${instance.round} has fallen! Everyone is making their secret night selections.`
    });

    instance.emitEvent('game_state_updated');
  }

  // Backwards compatibility aliases if called anywhere
  static startPhase1(instance) { this.startNightPhase(instance); }
  static startPhase2(instance) { this.startNightPhase(instance); }
  static startPhase3(instance) { this.startNightPhase(instance); }

  /**
   * Evaluate consensus among living murderers.
   */
  static evaluateMurdererConsensus(instance) {
    const livingMurderers = instance.getLivingMurdererIds();
    if (livingMurderers.length === 0) {
      instance.confirmedMurdererVictimId = null;
      return;
    }

    const votes = [];
    for (const mId of livingMurderers) {
      if (instance.murdererVotes.has(mId)) {
        votes.push(instance.murdererVotes.get(mId));
      }
    }

    if (votes.length === livingMurderers.length && votes.length > 0) {
      const firstTarget = votes[0];
      const allAgree = votes.every(t => t === firstTarget);
      instance.confirmedMurdererVictimId = allAgree ? firstTarget : null;
    } else {
      instance.confirmedMurdererVictimId = null;
    }
  }

  /**
   * Process murderer vote or target swap
   */
  static handleMurdererVote(instance, socketId, targetId, room) {
    const roleInfo = instance.roles.get(socketId);
    const isAlive = roleInfo ? roleInfo.isAlive && !instance.eliminatedPlayers.has(socketId) : false;

    if (instance.phase === 'night' && isAlive && roleInfo && roleInfo.role === 'murderer') {
      const targetRole = instance.roles.get(targetId);
      // Target must be a living non-murderer, not self, and not the host
      if (
        targetId &&
        targetId !== socketId &&
        targetId !== room.hostId &&
        targetId !== instance.hostSocketId &&
        !instance.eliminatedPlayers.has(targetId) &&
        targetRole &&
        targetRole.role !== 'murderer'
      ) {
        instance.murdererVotes.set(socketId, targetId);
        this.evaluateMurdererConsensus(instance);

        const entry = ActionLedger.getEntry(instance.hostActionLedger, instance.round);
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
        if (instance.confirmedMurdererVictimId) {
          const victimPlayer = room.players.get(instance.confirmedMurdererVictimId);
          entry.confirmedVictimName = victimPlayer ? victimPlayer.name : null;
        } else {
          entry.confirmedVictimName = null;
        }
      }
    }
  }

  /**
   * Process Doctor protection save
   */
  static handleDoctorSave(instance, socketId, targetId, room) {
    const roleInfo = instance.roles.get(socketId);
    const isAlive = roleInfo ? roleInfo.isAlive && !instance.eliminatedPlayers.has(socketId) : false;

    if (instance.phase === 'night' && isAlive && roleInfo && roleInfo.role === 'doctor') {
      // Target must be a living player (including self), not the host, and not saved in the immediately preceding round
      if (
        targetId &&
        targetId !== room.hostId &&
        targetId !== instance.hostSocketId &&
        !instance.eliminatedPlayers.has(targetId) &&
        targetId !== instance.previousDoctorSavedId
      ) {
        instance.currentDoctorSavedId = targetId;

        const entry = ActionLedger.getEntry(instance.hostActionLedger, instance.round);
        const docPlayer = room.players.get(socketId);
        const savedPlayer = room.players.get(targetId);
        entry.doctorSave = {
          doctorName: docPlayer ? docPlayer.name : 'Doctor',
          savedName: savedPlayer ? savedPlayer.name : 'Unknown'
        };
      }
    }
  }

  /**
   * Process Detective investigation inquiry
   */
  static handleDetectiveInvestigate(instance, socketId, targetId, room) {
    const roleInfo = instance.roles.get(socketId);
    const isAlive = roleInfo ? roleInfo.isAlive && !instance.eliminatedPlayers.has(socketId) : false;

    if (instance.phase === 'night' && isAlive && roleInfo && roleInfo.role === 'detective') {
      if (instance.currentDetectiveInquiry) return;

      const hist = instance.detectiveHistory.get(socketId) || [];
      const alreadyInvestigated = hist.some(h => h.suspectId === targetId);

      // Cannot investigate themselves, the host, dead players, or anyone already investigated
      if (
        targetId &&
        targetId !== socketId &&
        targetId !== room.hostId &&
        targetId !== instance.hostSocketId &&
        !instance.eliminatedPlayers.has(targetId) &&
        !alreadyInvestigated
      ) {
        const targetRole = instance.roles.get(targetId);
        const isMurderer = targetRole ? targetRole.role === 'murderer' : false;
        instance.currentDetectiveInquiry = { suspectId: targetId, isMurderer };

        const targetPlayer = room.players.get(targetId);
        hist.push({
          round: instance.round,
          suspectId: targetId,
          suspectName: targetPlayer ? targetPlayer.name : 'Player',
          isMurderer
        });
        instance.detectiveHistory.set(socketId, hist);

        const entry = ActionLedger.getEntry(instance.hostActionLedger, instance.round);
        const detPlayer = room.players.get(socketId);
        const susPlayer = room.players.get(targetId);
        entry.detectiveInquiry = {
          detectiveName: detPlayer ? detPlayer.name : 'Detective',
          suspectName: susPlayer ? susPlayer.name : 'Unknown',
          isMurderer
        };
      }
    }
  }

  /**
   * Process Civilian favorite alive player selection
   */
  static handleCivilianFavorite(instance, socketId, targetId, room) {
    const roleInfo = instance.roles.get(socketId);
    const isAlive = roleInfo ? roleInfo.isAlive && !instance.eliminatedPlayers.has(socketId) : false;

    if (instance.phase === 'night' && isAlive && roleInfo && roleInfo.role === 'civilian') {
      // Must be a living player, not self, not the host, and not dead
      if (
        targetId &&
        targetId !== socketId &&
        targetId !== room.hostId &&
        targetId !== instance.hostSocketId &&
        !instance.eliminatedPlayers.has(targetId)
      ) {
        instance.civilianFavorites.set(socketId, targetId);

        const entry = ActionLedger.getEntry(instance.hostActionLedger, instance.round);
        if (!entry.civilianFavorites) entry.civilianFavorites = [];
        const cPlayer = room.players.get(socketId);
        const tPlayer = room.players.get(targetId);
        const existing = entry.civilianFavorites.find(f => f.civilianId === socketId);
        if (existing) {
          existing.targetName = tPlayer ? tPlayer.name : 'Unknown';
        } else {
          entry.civilianFavorites.push({
            civilianId: socketId,
            civilianName: cPlayer ? cPlayer.name : 'Civilian',
            targetName: tPlayer ? tPlayer.name : 'Unknown'
          });
        }
      }
    }
  }
}

module.exports = NightPhaseHandler;
