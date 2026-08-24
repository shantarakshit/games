/**
 * RoleManager
 * Handles role definitions, player-to-murderer count balancing, and secret role assignment for Mafia.
 */
class RoleManager {
  /**
   * Determine number of murderers based on player count and settings
   * @param {number} numPlayers 
   * @param {string|number} setting 
   * @returns {number}
   */
  static getMurdererCount(numPlayers, setting) {
    let numMurderers = 1;
    if (setting === 1 || setting === '1') {
      numMurderers = 1;
    } else if (setting === 2 || setting === '2') {
      numMurderers = Math.min(2, Math.max(1, Math.floor((numPlayers - 2) / 2)));
    } else if (setting === 3 || setting === '3') {
      numMurderers = Math.min(3, Math.max(1, Math.floor((numPlayers - 2) / 2)));
    } else {
      // Auto distribution based on group size
      if (numPlayers >= 14) {
        numMurderers = 3;
      } else if (numPlayers >= 9) {
        numMurderers = 2;
      } else {
        numMurderers = 1;
      }
    }

    // Clamp murderers to ensure game balance
    if (numPlayers <= 3) {
      numMurderers = 1;
    } else {
      numMurderers = Math.min(numMurderers, Math.floor((numPlayers - 1) / 2));
    }
    if (numMurderers < 1) numMurderers = 1;

    return numMurderers;
  }

  /**
   * Distribute roles among connected players in the room
   * @param {Object} room 
   * @param {Object} settings 
   * @param {string} hostSocketId 
   * @returns {Map<string, { role: string, isAlive: boolean }>}
   */
  static distributeRoles(room, settings, hostSocketId) {
    const roles = new Map();
    const allSockets = Array.from(room.players.keys());
    const playerSockets = allSockets.filter(id => id !== hostSocketId);

    const numMurderers = this.getMurdererCount(playerSockets.length, settings.murderersCount);
    const shuffled = [...playerSockets].sort(() => Math.random() - 0.5);

    // Assign Host
    if (hostSocketId && allSockets.includes(hostSocketId)) {
      roles.set(hostSocketId, { role: 'host', isAlive: true });
    }

    // Assign Murderers
    const murdererIds = shuffled.slice(0, numMurderers);
    murdererIds.forEach(id => {
      roles.set(id, { role: 'murderer', isAlive: true });
    });

    let cursor = numMurderers;

    // Assign Doctor (if at least 2 non-host players)
    if (cursor < shuffled.length) {
      const doctorId = shuffled[cursor++];
      roles.set(doctorId, { role: 'doctor', isAlive: true });
    }

    // Assign Detective (if at least 3 non-host players)
    if (cursor < shuffled.length) {
      const detectiveId = shuffled[cursor++];
      roles.set(detectiveId, { role: 'detective', isAlive: true });
    }

    // Assign Civilians to all remaining
    while (cursor < shuffled.length) {
      const civId = shuffled[cursor++];
      roles.set(civId, { role: 'civilian', isAlive: true });
    }

    return roles;
  }
}

module.exports = RoleManager;
