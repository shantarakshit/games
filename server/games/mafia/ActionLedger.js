/**
 * ActionLedger
 * Manages host secret action tracking, ledger histories, and end-of-match timelines.
 */
class ActionLedger {
  /**
   * Helper: Retrieve or initialize round entry in hostActionLedger.
   * @param {Array} ledger 
   * @param {number} round 
   * @returns {Object}
   */
  static getEntry(ledger, round) {
    let entry = ledger.find(e => e.round === round);
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
      ledger.push(entry);
    }
    return entry;
  }

  /**
   * Record night resolution summary into match timeline
   * @param {Object} instance 
   */
  static recordNightTimeline(instance) {
    let roundRecord = instance.timeline.find(t => t.round === instance.round);
    if (!roundRecord) {
      roundRecord = { round: instance.round };
      instance.timeline.push(roundRecord);
    }

    const victimPlayer = instance.confirmedMurdererVictimId ? instance.room.players.get(instance.confirmedMurdererVictimId) : null;
    const doctorSavedPlayer = instance.currentDoctorSavedId ? instance.room.players.get(instance.currentDoctorSavedId) : null;
    const detInquiry = instance.currentDetectiveInquiry;
    const detSuspectPlayer = detInquiry ? instance.room.players.get(detInquiry.suspectId) : null;

    roundRecord.night = {
      murdererTargetId: instance.confirmedMurdererVictimId,
      murdererTargetName: victimPlayer ? victimPlayer.name : 'None',
      doctorSavedId: instance.currentDoctorSavedId,
      doctorSavedName: doctorSavedPlayer ? doctorSavedPlayer.name : 'None',
      wasSaved: instance.morningWasSaved,
      morningVictimId: instance.morningWasSaved ? null : instance.confirmedMurdererVictimId,
      morningVictimName: instance.morningWasSaved ? null : (victimPlayer ? victimPlayer.name : 'None'),
      detectiveInquiry: detInquiry ? {
        suspectId: detInquiry.suspectId,
        suspectName: detSuspectPlayer ? detSuspectPlayer.name : 'Unknown',
        isMurderer: detInquiry.isMurderer
      } : null
    };
  }

  /**
   * Append Day round summary to the timeline
   * @param {object} instance 
   * @param {number} maxVotes 
   * @param {boolean} isTie 
   * @param {string|null} eliminatedId 
   */
  static recordDayTimeline(instance, maxVotes, isTie, eliminatedId) {
    let roundRecord = instance.timeline.find(t => t.round === instance.round);
    if (!roundRecord) {
      roundRecord = { round: instance.round };
      instance.timeline.push(roundRecord);
    }

    const elimPlayer = eliminatedId ? instance.room.players.get(eliminatedId) : null;
    const elimRole = (eliminatedId && instance.roles.get(eliminatedId)) ? instance.roles.get(eliminatedId).role : null;

    roundRecord.day = {
      maxVotes,
      isTie,
      eliminatedId,
      eliminatedName: elimPlayer ? elimPlayer.name : null,
      eliminatedRole: elimRole,
      tallyData: [...instance.tallyData]
    };
  }
}

module.exports = ActionLedger;
